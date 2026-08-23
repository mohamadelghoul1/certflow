import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { formatISODate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import type { Firm, Quote, QuoteFeeLine } from "@/types/db";

// Everything the quote document says, computed once — the on-screen page
// and the Word export both read this, so the two can never drift apart
// the way the certificate package once did.

export type QuoteDocumentData = {
  quote: Quote;
  feeLines: QuoteFeeLine[];
  firm: Firm | null;
  applicant: { name?: string; email?: string; phone?: string };
  certifierName: string | null;
  subtotal: number;
  gst: number;
  total: number;
  pathwayFull: string;
  validUntil: string | null;
  validityLine: string;
  activeTerms: string;
  quoteNumber: string;
  logoUrl: string | null;
};

export async function getQuoteDocumentData(quoteId: string, firmId: string, client?: SupabaseClient): Promise<QuoteDocumentData | null> {
  const supabase = client ?? (await createClient());

  const [{ data: rawQuote }, { data: lines }, { data: firm }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", quoteId).eq("firm_id", firmId).single(),
    supabase.from("quote_fee_lines").select("*").eq("quote_id", quoteId).order("sort_order"),
    supabase.from("firms").select("*").eq("id", firmId).single(),
  ]);
  if (!rawQuote) return null;
  const quote = rawQuote as Quote;
  const feeLines = (lines || []) as QuoteFeeLine[];
  const firmData = (firm as Firm | null) || null;
  const applicant = (quote.applicant || {}) as { name?: string; email?: string; phone?: string };

  const certifierName = quote.certifier_id
    ? (await supabase.from("certifiers").select("name").eq("id", quote.certifier_id).single()).data?.name || firmData?.name || null
    : firmData?.name || null;

  const subtotal = feeLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;
  const pathwayFull = quote.pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate";

  // The quote's validity is its required end date; older quotes that
  // stored an "Until yyyy-mm-dd" cutoff keep honouring it, and a quote
  // with no end date falls back to the classic 7-day wording.
  const validUntil = quote.valid_for?.startsWith("Until ")
    ? formatISODate(quote.valid_for.slice(6))
    : quote.required_end_date
      ? formatISODate(quote.required_end_date)
      : null;
  const validityLine = validUntil ? `valid until ${validUntil}` : `valid for 7 days from the date of fee proposal issuance`;

  const defaultTerms = [
    `${firmData?.name || "Our firm"} is pleased to submit a fee proposal to provide building approval and certification services for the proposed development.`,
    `We pride ourselves on our ability to deliver easier and faster building approvals, and to add value and exceed client expectations at every stage of the approval process.`,
    `Thank you for the opportunity. We look forward to establishing a working relationship with your business and your staff.`,
  ].join("\n\n");
  const activeTerms = quote.terms_override || defaultTerms;

  const quoteNumber = quote.quote_number?.trim() || quote.id.slice(0, 8).toUpperCase();
  const logoUrl = firmData?.logo_url ? await signedUrl(firmData.logo_url, 3600, supabase) : null;

  return { quote, feeLines, firm: firmData, applicant, certifierName, subtotal, gst, total, pathwayFull, validUntil, validityLine, activeTerms, quoteNumber, logoUrl };
}
