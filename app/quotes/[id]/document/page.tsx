import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { today } from "@/lib/business";
import { QuoteDocument, QuoteTermsEditor } from "@/components/certifier/QuoteDocument";
import type { Firm, Quote, QuoteFeeLine } from "@/types/db";

export default async function QuoteDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const [{ data: rawQuote }, { data: lines }, { data: firm }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).eq("firm_id", profile.firm_id).single(),
    supabase.from("quote_fee_lines").select("*").eq("quote_id", id).order("sort_order"),
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
  ]);
  if (!rawQuote) notFound();
  const quote = rawQuote as Quote;
  const feeLines = (lines || []) as QuoteFeeLine[];
  const applicant = (quote.applicant || {}) as { name?: string; email?: string; phone?: string };
  const firmData = firm as Firm | null;

  const certifierName = quote.certifier_id
    ? (await supabase.from("certifiers").select("name").eq("id", quote.certifier_id).single()).data?.name || firmData?.name
    : firmData?.name;

  const subtotal = feeLines.reduce((sum, l) => sum + (Number(l.amount) || 0) * (Number(l.quantity) || 1), 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;
  const pathwayFull = quote.pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate";
  const validForDays = (quote.valid_for || "").replace(" Days", "").replace(" Day", "");

  const defaultTerms = [
    `${firmData?.name || "Our firm"} is pleased to submit a fee proposal to provide building approval and certification services for the proposed development.`,
    `We pride ourselves on our ability to deliver easier and faster building approvals, and to add value and exceed client expectations at every stage of the approval process.`,
    `Thank you for the opportunity. We look forward to establishing a working relationship with your business and your staff.`,
  ].join("\n\n");
  const activeTerms = quote.terms_override || defaultTerms;

  const mailtoTo = applicant.email || "";
  const mailtoSubject = `Fee Quote ${quote.id.slice(0, 8).toUpperCase()} — ${quote.proposal_address || "Your project"}`;
  const mailtoBody = [
    `Hi ${applicant.name || "there"},`,
    "",
    `Please find attached our fee quote for ${quote.proposal_address || "your project"}.`,
    `Total (incl. GST): $${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    `This quote is valid for ${quote.valid_for || "7 Days"} from the date of issue.`,
    "",
    "Please attach the quote document (downloaded via Export as Word or Print/Save as PDF) before sending.",
    "",
    "Kind regards,",
    certifierName || "",
    firmData?.name || "",
  ].join("\n");
  const mailtoHref = `mailto:${mailtoTo}?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(mailtoBody)}`;

  return (
    <QuoteDocument
      backHref={`/quotes/${id}`}
      filename={`Quote-${id.slice(0, 8)}.doc`}
      mailtoHref={mailtoHref}
      hasApplicantEmail={!!applicant.email}
    >
      <div className="max-w-2xl mx-auto p-8 bg-white text-slate-900 print:max-w-none">
        <div className="flex justify-between items-start pb-3 mb-1">
          <div>
            <div className="text-xl font-black tracking-tight">{firmData?.name}</div>
          </div>
          <div className="text-right text-xs text-slate-700 leading-relaxed">
            <div className="font-bold">{firmData?.name} Pty Ltd</div>
            <div>{firmData?.office_address}</div>
            <div className="mt-1">Phone: {firmData?.phone}</div>
            <div className="text-blue-700 underline">{firmData?.email}</div>
            {firmData?.website && <div className="text-blue-700 underline">{firmData.website}</div>}
          </div>
        </div>
        <div className="border-b border-slate-800 mb-4" />

        <div className="flex justify-between text-sm mb-6">
          <div>Quote Number: {id.slice(0, 8).toUpperCase()}</div>
          <div>Date: {today()}</div>
        </div>

        <div className="text-center mb-6">
          <div className="font-bold">FEE PROPOSAL</div>
          <div className="font-bold">FOR</div>
          <div className="font-bold">{pathwayFull} and Principal Certifier Services</div>
        </div>

        <div className="text-sm mb-3">
          <u className="font-semibold">Property Address:</u> {quote.proposal_address || "—"}
        </div>
        <div className="text-sm mb-4">
          <u className="font-semibold">Job Description:</u> {quote.development_description || "—"}
        </div>

        <div className="text-sm font-semibold underline mb-2">Scope of Works</div>
        <ul className="list-disc pl-6 text-sm mb-6 space-y-0.5">
          {(quote.scope_of_works || []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>

        <table className="w-full mb-1 border border-slate-300 text-sm">
          <thead>
            <tr style={{ backgroundColor: "#B8B49A" }}>
              <th className="text-left font-semibold px-3 py-2 border border-slate-300">Description</th>
              <th className="text-center font-semibold px-3 py-2 border border-slate-300 w-24">Quantity</th>
              <th className="text-right font-semibold px-3 py-2 border border-slate-300 w-28">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            {feeLines.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-1.5 border border-slate-300">{l.description || "—"}</td>
                <td className="px-3 py-1.5 border border-slate-300 text-center">{l.quantity || "1"}</td>
                <td className="px-3 py-1.5 border border-slate-300 text-right">{l.amount ? Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col items-end gap-0.5 text-sm mb-4">
          <div className="flex gap-4">
            <span className="text-slate-500">Subtotal:</span>
            <span>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-slate-500">GST:</span>
            <span>${gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex gap-4 font-bold">
            <span>Total:</span>
            <span>${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="text-sm font-bold underline mb-4">***Our fee is valid for {validForDays || "7"} days from the date of fee proposal issuance.</div>

        <QuoteTermsEditor quoteId={id} activeTerms={activeTerms} hasOverride={!!quote.terms_override} />

        <div className="text-sm mt-6">
          <div>Kind Regards</div>
          <div>{firmData?.name} Pty Ltd</div>
        </div>
      </div>
    </QuoteDocument>
  );
}
