import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildInvoicePdf } from "@/lib/pdf/invoice";
import { portalInvoiceRows } from "@/lib/invoices/portalInvoices";
import { readPdf } from "./helpers/readDocuments";
import type { Invoice, InvoiceLine } from "@/types/db";

const firm = {
  name: "QP Certifiers",
  abn: "11 222 333 444",
  postal_address: "PO Box 1, Yagoona NSW 2199",
  office_address: "16 Wilkins Street, Yagoona NSW 2199",
  phone: "0400 000 000",
  email: "info@qpcertifiers.com.au",
  website: "qpcertifiers.com.au",
  logo_url: null,
};

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "3f6d9a20-0000-0000-0000-000000000000",
    firm_id: "firm-1",
    job_id: "job-1",
    quote_id: null,
    client_id: "client-1",
    invoice_number: "INV-0007",
    status: "sent",
    issue_date: "2026-08-14",
    due_date: "2026-08-28",
    bill_to: "Jane Nguyen",
    reference: "21 Coquet Way, Green Valley",
    notes: null,
    payment_details: "BSB 062-000  Acc 1234 5678",
    paid_date: null,
    created_at: "2026-08-14T00:00:00Z",
    ...overrides,
  };
}

const lines: InvoiceLine[] = [
  { id: "l1", invoice_id: "i1", description: "Complying Development Certificate", quantity: "1", amount: 2500, sort_order: 0 } as InvoiceLine,
  { id: "l2", invoice_id: "i1", description: "Principal Certifier appointment", quantity: "1", amount: 1500, sort_order: 1 } as InvoiceLine,
];

async function pdfText(inv: Invoice, feeLines: InvoiceLine[] = lines) {
  const bytes = await buildInvoicePdf({ firm, invoice: inv, lines: feeLines }, { logo: null });
  const { text } = await readPdf(bytes);
  return text.replace(/\s+/g, " ");
}

describe("the invoice PDF", () => {
  // The file that goes out attached to the email and sits on the portal.
  // It carries the firm's letterhead and the same arithmetic the printed
  // page shows — GST added at a tenth, not folded into the fees.
  test("carries the letterhead, the fees and the totals", async () => {
    const text = await pdfText(invoice());
    assert.ok(text.includes("Tax Invoice"));
    assert.ok(text.includes("QP Certifiers"));
    assert.ok(text.includes("Bill to"));
    assert.ok(text.includes("Amount due"), "the figure the client opened the file for");
    assert.ok(text.includes("Due date"));
    assert.ok(text.includes("11 222 333 444"), "the ABN belongs on a tax invoice");
    assert.ok(text.includes("INV-0007"));
    assert.ok(text.includes("Jane Nguyen"));
    assert.ok(text.includes("21 Coquet Way, Green Valley"));
    assert.ok(text.includes("Complying Development Certificate"));
    assert.ok(text.includes("$4,000.00"), "subtotal");
    assert.ok(text.includes("$400.00"), "GST at 10%");
    assert.ok(text.includes("$4,400.00"), "total due");
    assert.ok(text.includes("Total GST 10%"), "GST named as a tax invoice must name it");
    assert.ok(text.includes("BSB 062-000"));
  });

  test("shows the card link and its surcharge when there is one", async () => {
    const text = await pdfText(invoice({ stripe_payment_link_url: "https://pay.example.com/abc", card_surcharge: 79.2 }));
    assert.ok(text.includes("https://pay.example.com/abc"));
    assert.ok(text.includes("$79.20"));
    assert.ok(text.includes("$4,479.20"), "the card total, so nobody is surprised at the checkout");
  });

  test("a paid invoice says so, and a void one says that", async () => {
    const paid = await pdfText(invoice({ status: "paid", paid_date: "2026-08-20" }));
    assert.ok(paid.includes("Amount paid"), "not still asking for money that has arrived");
    assert.ok(paid.includes("Paid 20 Aug 2026"));
    assert.ok((await pdfText(invoice({ status: "void" }))).includes("Void"));
  });

  // An invoice with no fees on it yet still has to produce a file rather
  // than throw — the certifier can email themselves a draft copy.
  test("survives an invoice with no lines and no letterhead", async () => {
    const bytes = await buildInvoicePdf({ firm: null, invoice: invoice({ payment_details: null }), lines: [] }, { logo: null });
    const { text, pageCount } = await readPdf(bytes);
    assert.equal(pageCount, 1);
    assert.ok(text.includes("Tax Invoice"));
  });
});

describe("what the client portal shows", () => {
  const rows = [
    invoice({ id: "a", invoice_number: "INV-0001", issue_date: "2026-07-01", due_date: "2026-07-15", status: "sent", stripe_payment_link_url: "https://pay/1" }),
    invoice({ id: "b", invoice_number: "INV-0002", issue_date: "2026-08-01", status: "paid", paid_date: "2026-08-03", stripe_payment_link_url: "https://pay/2" }),
    invoice({ id: "c", invoice_number: "INV-0003", issue_date: "2026-08-10", status: "draft" }),
    invoice({ id: "d", invoice_number: "INV-0004", issue_date: "2026-08-11", status: "void" }),
  ].map((inv) => ({ ...inv, invoice_lines: [{ amount: 1000 }] }));

  test("hides drafts and voided invoices", () => {
    const shown = portalInvoiceRows(rows, "2026-08-28").map((r) => r.number);
    assert.deepEqual(shown, ["INV-0002", "INV-0001"], "newest first, nothing unissued or cancelled");
  });

  test("marks an unpaid invoice overdue once its due date has passed", () => {
    const [, first] = portalInvoiceRows(rows, "2026-08-28");
    assert.equal(first.number, "INV-0001");
    assert.equal(first.overdue, true);
    assert.equal(first.total, 1100, "GST added, as on the invoice itself");
  });

  // Paying an invoice twice is a refund, an apology and a phone call, so
  // the pay button is only ever offered on an unpaid one.
  test("offers the payment link only while the invoice is unpaid", () => {
    const shown = portalInvoiceRows(rows, "2026-08-28");
    assert.equal(shown.find((r) => r.number === "INV-0001")?.payUrl, "https://pay/1");
    assert.equal(shown.find((r) => r.number === "INV-0002")?.payUrl, null);
  });
});
