import type { SupabaseClient } from "@supabase/supabase-js";
import { signedUrl } from "@/lib/storage";
import { fetchStampImage } from "@/lib/pdf/stamp";
import { buildInvoicePdf } from "@/lib/pdf/invoice";
import { invoiceNumberOf } from "@/lib/invoices/invoiceLogic";
import { jobDocumentName } from "@/lib/downloadName";
import type { ClientContact, Firm, Invoice, InvoiceLine } from "@/types/db";

// One place that turns an invoice row into a finished PDF, because
// three different callers need exactly the same file: the certifier's
// Download PDF, the client's copy in the portal, and the attachment on
// the email. Built here rather than three times over, so they can never
// come out as three different documents.
//
// The caller passes the client it already has. A certifier's own
// session reads its firm's invoices under RLS; the portal and the
// nightly reminder sweep pass the admin client, having established for
// themselves that the person asking is entitled to this invoice.

export type InvoiceFile = { bytes: Uint8Array; fileName: string; number: string };

export async function buildInvoiceFile(invoiceId: string, db: SupabaseClient): Promise<InvoiceFile | null> {
  const { data: rawInvoice } = await db.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!rawInvoice) return null;
  const invoice = rawInvoice as Invoice;

  const [{ data: lines }, { data: firm }, { data: client }] = await Promise.all([
    db.from("invoice_lines").select("*").eq("invoice_id", invoiceId).order("sort_order"),
    db.from("firms").select("*").eq("id", invoice.firm_id).maybeSingle(),
    // The client's own email and phone belong in the address block, and
    // they are already on the client record this invoice was raised
    // against. Scoped to the invoice's own firm, because the admin
    // client the portal and the reminder sweep pass bypasses RLS.
    invoice.client_id
      ? db.from("clients").select("*").eq("id", invoice.client_id).eq("firm_id", invoice.firm_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const letterhead = (firm as Firm | null) || null;
  const logoUrl = letterhead?.logo_url ? await signedUrl(letterhead.logo_url, 600, db) : null;
  const logo = await fetchStampImage(logoUrl);

  const bytes = await buildInvoicePdf(
    { firm: letterhead, invoice, lines: (lines || []) as InvoiceLine[], recipient: (client as ClientContact | null) || null },
    { logo }
  );
  const number = invoiceNumberOf(invoice);
  return { bytes, fileName: jobDocumentName(number, invoice.reference || "", "Tax Invoice", "pdf"), number };
}
