import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatISODate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { invoiceTotals, invoiceNumberOf, formatMoney } from "@/lib/invoices/invoiceLogic";
import { PrintButton } from "@/components/PrintButton";
import type { Firm, Invoice, InvoiceLine } from "@/types/db";

// The printed tax invoice, on the same letterhead as the quote it grew
// from. Lives outside the app chrome so Print / Save as PDF captures
// only the document.
export default async function InvoiceDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const [{ data: rawInvoice }, { data: lines }, { data: firm }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).eq("firm_id", profile.firm_id).single(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", id).order("sort_order"),
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
  ]);
  if (!rawInvoice) notFound();
  const invoice = rawInvoice as Invoice;
  const firmData = (firm as Firm | null) || null;
  const feeLines = (lines || []) as InvoiceLine[];
  const { subtotal, gst, total } = invoiceTotals(feeLines);

  // Embedded as data so a saved copy keeps its logo after the signed URL
  // expires — same approach as the quote document.
  let logoSrc: string | null = null;
  const logoUrl = firmData?.logo_url ? await signedUrl(firmData.logo_url, 3600, supabase) : null;
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        logoSrc = `data:${res.headers.get("content-type") || "image/png"};base64,${buffer.toString("base64")}`;
      }
    } catch {
      // The page still renders with the firm name alone.
    }
  }

  return (
    <div className="min-h-screen bg-surface print:bg-white">
      <div className="max-w-2xl mx-auto py-6 px-4 print:hidden flex items-center justify-between flex-wrap gap-2">
        <Link href={`/invoices/${id}`} className="text-sm text-placeholder hover:text-primary">
          ← Back to invoice
        </Link>
        <PrintButton label="Save as PDF" />
      </div>

      <div className="max-w-2xl mx-auto p-8 bg-white text-heading print:max-w-none">
        <div className="flex justify-between items-start pb-3 mb-1">
          <div>
            {logoSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={`${firmData?.name || "Firm"} logo`} className="h-16 w-auto object-contain mb-3" />
            )}
            <div className="text-xl font-black tracking-tight">{firmData?.name}</div>
          </div>
          <div className="text-right text-xs text-muted leading-relaxed">
            <div className="font-bold">{firmData?.name}</div>
            {firmData?.abn && <div>ABN {firmData.abn}</div>}
            <div>{firmData?.office_address}</div>
            <div className="mt-1">Phone: {firmData?.phone}</div>
            <div className="text-info underline">{firmData?.email}</div>
          </div>
        </div>
        <div className="border-b border-heading mb-4" />

        <div className="text-center mb-6">
          <div className="text-lg font-black tracking-wide">TAX INVOICE</div>
        </div>

        <div className="flex justify-between text-sm mb-6 flex-wrap gap-2">
          <div className="space-y-0.5">
            <div>
              <span className="font-semibold">Invoice number:</span> {invoiceNumberOf(invoice)}
            </div>
            {invoice.bill_to && (
              <div>
                <span className="font-semibold">Bill to:</span> {invoice.bill_to}
              </div>
            )}
            {invoice.reference && (
              <div>
                <span className="font-semibold">Re:</span> {invoice.reference}
              </div>
            )}
          </div>
          <div className="space-y-0.5 text-right">
            <div>
              <span className="font-semibold">Issued:</span> {formatISODate(invoice.issue_date)}
            </div>
            {invoice.due_date && (
              <div>
                <span className="font-semibold">Due:</span> {formatISODate(invoice.due_date)}
              </div>
            )}
            {invoice.status === "paid" && invoice.paid_date && <div className="font-semibold text-success">Paid {formatISODate(invoice.paid_date)}</div>}
            {invoice.status === "void" && <div className="font-semibold">VOID</div>}
          </div>
        </div>

        <table className="w-full mb-1 border border-line text-sm">
          <thead>
            <tr style={{ backgroundColor: "#B8B49A" }}>
              <th className="text-left font-semibold px-3 py-2 border border-line">Description</th>
              <th className="text-right font-semibold px-3 py-2 border border-line w-32">Amount (ex GST)</th>
            </tr>
          </thead>
          <tbody>
            {feeLines.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-1.5 border border-line whitespace-pre-line">{l.description || "—"}</td>
                <td className="px-3 py-1.5 border border-line text-right align-top">{formatMoney(Number(l.amount) || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col items-end gap-0.5 text-sm mb-6">
          <div className="flex gap-4">
            <span className="text-placeholder">Subtotal:</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-placeholder">GST (10%):</span>
            <span>{formatMoney(gst)}</span>
          </div>
          <div className="flex gap-4 font-bold text-base">
            <span>Total due:</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>

        {(invoice.payment_details || invoice.stripe_payment_link_url) && (
          <div className="text-sm mb-6 border border-line rounded-md p-4">
            <div className="font-semibold mb-1">Payment details</div>
            {invoice.payment_details && <div className="whitespace-pre-line">{invoice.payment_details}</div>}
            {invoice.stripe_payment_link_url && (
              <div className={invoice.payment_details ? "mt-2" : ""}>
                Pay online by card: <a href={invoice.stripe_payment_link_url} className="text-info underline break-all">{invoice.stripe_payment_link_url}</a>
                {invoice.card_surcharge ? (
                  <div className="text-xs text-muted mt-0.5">
                    Card payments carry a {formatMoney(Number(invoice.card_surcharge))} processing surcharge (total {formatMoney(total + Number(invoice.card_surcharge))}); bank
                    transfer avoids it.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {invoice.notes && <div className="text-sm whitespace-pre-line mb-6">{invoice.notes}</div>}

        <div className="text-sm mt-6">
          <div>Kind Regards</div>
          <div>{firmData?.name}</div>
        </div>
      </div>
    </div>
  );
}
