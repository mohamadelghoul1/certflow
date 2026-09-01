import { csvCell, csvRow } from "@/lib/csv";
import { invoiceNumberOf } from "@/lib/invoices/invoiceLogic";
import type { Invoice, InvoiceLine } from "@/types/db";

// The firm's invoices as a file Xero can import.
//
// A full Xero connection is a permanent maintenance obligation — an
// account, tokens that expire, an API that moves. A monthly CSV is a
// minute of a bookkeeper's time and nothing to keep alive, which is the
// right trade until the volume says otherwise.
//
// The columns are Xero's own Sales Invoice import template. One row per
// invoice line; Xero groups rows into invoices by the invoice number, so
// a three-line invoice is three rows carrying the same number, contact
// and dates.

export const XERO_COLUMNS = [
  "*ContactName",
  "EmailAddress",
  "POAddressLine1",
  "POCity",
  "PORegion",
  "POPostalCode",
  "POCountry",
  "*InvoiceNumber",
  "Reference",
  "*InvoiceDate",
  "*DueDate",
  "Description",
  "*Quantity",
  "*UnitAmount",
  "*AccountCode",
  "*TaxType",
  "Currency",
] as const;

export type XeroInvoice = Pick<Invoice, "id" | "invoice_number" | "issue_date" | "due_date" | "bill_to" | "reference" | "status"> & {
  client_name?: string | null;
  client_email?: string | null;
  lines: Pick<InvoiceLine, "description" | "quantity" | "amount" | "sort_order">[];
};

export type XeroCsvOptions = {
  // The revenue account these fees post to. 200 is "Sales" in Xero's
  // default Australian chart of accounts; a firm with its own chart
  // sets its own.
  accountCode: string;
  // Xero's Australian tax types: OUTPUT is GST on Income, EXEMPTOUTPUT
  // is GST Free Income, BASEXCLUDED is excluded from BAS entirely.
  taxType: string;
};

// Fees are held and printed ex-GST — the invoice adds a tenth at the
// bottom — so each line goes across at its ex-GST amount and Xero adds
// the GST from the tax type. Sending tax-inclusive amounts here would
// overstate every invoice by 10%.
function unitAmount(amount: number, quantity: number): string {
  const each = quantity > 0 ? amount / quantity : amount;
  return each.toFixed(2);
}

function quantityOf(raw: string | null | undefined): number {
  const parsed = Number(String(raw ?? "1").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

// Xero matches an existing contact by name, so this has to be the name
// the firm's books already know: whoever the invoice is billed to, and
// only then the client record it hangs off.
//
// "Bill to" is the invoice's whole address block — a name, then the
// postal address under it. Only its first line is a contact name; the
// rest would arrive in Xero as a contact called "Unit 104/7 Hoyle Ave".
export function contactNameFor(invoice: XeroInvoice): string {
  const billedTo = (invoice.bill_to || "").split("\n")[0].trim();
  return billedTo || (invoice.client_name || "").trim() || "Unknown contact";
}

export function xeroInvoiceCsv(invoices: XeroInvoice[], options: XeroCsvOptions): string {
  // Quoted, and anything that starts like a formula neutralised: a
  // contact name or a line description is typed by a person, and this
  // file is opened in a spreadsheet. See lib/csv.
  const lines: string[] = [csvRow(XERO_COLUMNS)];

  for (const invoice of invoices) {
    const number = invoiceNumberOf(invoice);
    const contact = contactNameFor(invoice);
    // An invoice with no fee lines still belongs in the file — left out,
    // it silently goes missing from the books. It carries one zero line
    // so the accountant sees it and can decide.
    const rows = invoice.lines.length > 0 ? [...invoice.lines].sort((a, b) => a.sort_order - b.sort_order) : [{ description: invoice.reference || "Certification fees", quantity: "1", amount: 0, sort_order: 0 }];

    for (const line of rows) {
      const quantity = quantityOf(line.quantity);
      lines.push(
        [
          contact,
          invoice.client_email || "",
          "",
          "",
          "",
          "",
          "AU",
          number,
          invoice.reference || "",
          invoice.issue_date,
          invoice.due_date || invoice.issue_date,
          line.description || "Certification fees",
          String(quantity),
          unitAmount(Number(line.amount) || 0, quantity),
          options.accountCode,
          options.taxType,
          "AUD",
        ]
          .map((value) => csvCell(value))
          .join(",")
      );
    }
  }

  return lines.join("\r\n");
}
