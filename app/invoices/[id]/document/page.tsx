import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { signedUrl } from "@/lib/storage";
import { invoiceView } from "@/lib/invoices/invoiceLayout";
import { PrintButton } from "@/components/PrintButton";
import type { ClientContact, Firm, Invoice, InvoiceLine } from "@/types/db";

// The printed tax invoice.
//
// Laid out the way an accounting system lays one out — the title and the
// firm's mark across the top, who it is for facing who it is from, then
// the figure owed and the date it is owed by set large enough to read
// across a desk. The same blocks, in the same order, as the PDF that
// goes to the client, because they are both drawing what
// lib/invoices/invoiceLayout.ts worked out.
//
// Lives outside the app chrome so Print / Save as PDF captures only the
// document.
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

  // The client's own email and phone, so the address block carries them
  // without the certifier typing what the client record already holds.
  const { data: client } = invoice.client_id
    ? await supabase.from("clients").select("*").eq("id", invoice.client_id).eq("firm_id", profile.firm_id).maybeSingle()
    : { data: null };
  const recipient = (client as ClientContact | null) || null;

  const view = invoiceView({ firm: firmData, invoice, lines: feeLines, recipient });

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
      <div className="max-w-3xl mx-auto py-6 px-4 print:hidden flex items-center justify-between flex-wrap gap-2">
        <Link href={`/invoices/${id}`} className="text-sm text-placeholder hover:text-primary">
          ← Back to invoice
        </Link>
        <PrintButton label="Save as PDF" />
      </div>

      <div className="max-w-3xl mx-auto p-10 bg-white text-heading print:max-w-none print:p-0">
        <div className="flex justify-between items-start gap-6 mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Tax Invoice</h1>
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={`${firmData?.name || "Firm"} logo`} className="h-16 w-auto object-contain" />
          )}
        </div>

        <div className="flex justify-between gap-8 mb-10 text-sm">
          <div>
            <div className="font-semibold text-xs mb-1.5">Bill to</div>
            {view.billTo.length ? view.billTo.map((line) => <div key={line}>{line}</div>) : <div>—</div>}
          </div>
          <div className="text-right text-xs leading-relaxed text-muted">
            {view.firmLines.map((line, i) => (
              <div key={line} className={i === 0 ? "font-semibold text-heading text-sm" : undefined}>
                {line}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-16 mb-6">
          <div>
            <div className="text-xs text-muted">{view.headline.label}</div>
            <div className="text-3xl font-bold tracking-tight">{view.headline.value}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{view.headline.dueLabel}</div>
            <div className="text-3xl font-bold tracking-tight">{view.headline.dueValue}</div>
          </div>
        </div>

        {view.status && <div className={`text-sm font-semibold mb-5 ${view.status.paid ? "text-success" : "text-muted"}`}>{view.status.text}</div>}

        <div className="flex flex-wrap gap-x-12 gap-y-3 mb-6">
          {view.facts.map((fact) => (
            <div key={fact.label}>
              <div className="text-xs text-muted">{fact.label}</div>
              <div className="text-sm font-semibold">{fact.value}</div>
            </div>
          ))}
        </div>

        <div className="border-b-2 mb-6" style={{ borderColor: "#B8B49A" }} />

        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="text-xs text-muted">
              <th className="text-left font-normal pb-2">Description</th>
              <th className="text-right font-normal pb-2 w-20">Tax</th>
              <th className="text-right font-normal pb-2 w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {view.items.map((item, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-2.5 pr-4 whitespace-pre-line align-top">{item.description}</td>
                <td className="py-2.5 text-right align-top text-muted">{item.tax}</td>
                <td className="py-2.5 text-right align-top">{item.amount}</td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <td colSpan={3} className="p-0" />
            </tr>
          </tbody>
        </table>

        <div className="flex justify-end mb-10">
          <div className="w-72">
            {view.totals.map((row) => (
              <div
                key={row.label}
                className={`flex justify-between gap-6 py-1.5 ${row.ruleBefore ? "border-t border-line" : ""} ${row.strong ? "text-lg font-bold pt-2.5" : "text-sm"}`}
              >
                <span className={row.strong ? "" : "text-muted"}>{row.label}</span>
                <span className={row.strong ? "" : "font-medium"}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-md text-sm space-y-3">
          {view.notes && <div className="whitespace-pre-line">{view.notes}</div>}
          {view.paymentDetails && <div className="whitespace-pre-line">{view.paymentDetails}</div>}
          {view.payUrl && (
            <div>
              Pay online by card:{" "}
              <a href={view.payUrl} className="text-info underline break-all">
                {view.payUrl}
              </a>
              {view.surcharge && <div className="text-xs text-muted mt-0.5">{view.surcharge}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
