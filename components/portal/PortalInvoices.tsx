import { Download, CreditCard } from "lucide-react";
import { formatISODate } from "@/lib/business";
import { formatMoney } from "@/lib/invoices/invoiceLogic";
import type { PortalInvoice } from "@/lib/invoices/portalInvoices";

// The client's invoices, where the client already is.
//
// An invoice used to exist only in the inbox it was emailed to, which is
// the one place a person cannot find it again six weeks later. Here it
// sits beside the project it belongs to: the amount, whether it is paid,
// a PDF to keep, and — when the firm has card payments switched on — a
// button to pay it on the spot.
export function PortalInvoices({ invoices, title = "Invoices" }: { invoices: PortalInvoice[]; title?: string }) {
  if (invoices.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-line">
      <div className="px-5 py-3 border-b border-line font-bold text-primary">{title}</div>
      <div className="divide-y divide-line">
        {invoices.map((invoice) => {
          const tone = invoice.status === "paid" ? "bg-success-bg text-success" : invoice.overdue ? "bg-error-bg text-error" : "bg-info-bg text-info";
          const label = invoice.status === "paid" ? `Paid${invoice.paidDate ? ` ${formatISODate(invoice.paidDate)}` : ""}` : invoice.overdue ? "Overdue" : "Awaiting payment";
          return (
            <div key={invoice.id} className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold text-sm text-primary">
                  Invoice {invoice.number}
                  {invoice.reference ? ` — ${invoice.reference}` : ""}
                </div>
                <div className="text-xs text-placeholder mt-0.5">
                  Issued {formatISODate(invoice.issueDate)}
                  {invoice.dueDate ? ` · Due ${formatISODate(invoice.dueDate)}` : ""}
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-primary">{formatMoney(invoice.total)}</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${tone}`}>{label}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <a
                  href={`/api/portal/invoices/${invoice.id}/pdf`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-line text-sm text-primary font-medium hover:bg-hover"
                >
                  <Download size={15} /> Download PDF
                </a>
                {invoice.payUrl && (
                  <div className="text-right">
                    <a
                      href={invoice.payUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700"
                    >
                      <CreditCard size={15} /> Pay online
                    </a>
                    {invoice.cardSurcharge ? (
                      <div className="text-[11px] text-placeholder mt-1 max-w-[15rem]">
                        Card payments add a {formatMoney(invoice.cardSurcharge)} surcharge ({formatMoney(invoice.total + invoice.cardSurcharge)} in total).
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
