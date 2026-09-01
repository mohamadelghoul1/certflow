import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { invoiceView } from "@/lib/invoices/invoiceLayout";
import { contactNameFor } from "@/lib/invoices/xeroCsv";
import type { Invoice, InvoiceLine } from "@/types/db";

// What the invoice says, before anybody draws it. Both renderers — the
// PDF the client is sent and the page the certifier prints — place
// exactly these blocks, so this is where the wording is held to account.

const firm = {
  name: "QP Certifiers Pty Ltd",
  abn: "41 630 945 416",
  postal_address: "PO Box 1, Yagoona NSW 2199",
  office_address: "Suite 2/F1, 101 Rookwood Road, Yagoona NSW 2199",
  phone: "0404 940 898",
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
    invoice_number: "INV-26275",
    status: "sent",
    issue_date: "2026-09-01",
    due_date: "2026-09-08",
    bill_to: "The Granny Flat Experts, ABN: 29 155 078 014\nUnit 104/7 Hoyle Ave,\nCastle Hill NSW 2154",
    reference: "16 Hunter Street, Riverstone",
    notes: null,
    payment_details: "Bank: NAB\nBSB: 082-112",
    paid_date: null,
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

const lines = [{ id: "l1", invoice_id: "i1", description: "CDC/PC/OC Certifications", quantity: "1", amount: 1400, sort_order: 0 }] as InvoiceLine[];

const view = (inv = invoice(), recipient = null) => invoiceView({ firm, invoice: inv, lines, recipient });

describe("the invoice as it reads", () => {
  test("the address block keeps every line the certifier typed", () => {
    assert.deepEqual(view().billTo, [
      "The Granny Flat Experts, ABN: 29 155 078 014",
      "Unit 104/7 Hoyle Ave,",
      "Castle Hill NSW 2154",
    ]);
  });

  test("the client's own email and phone are added from their record", () => {
    const block = invoiceView({ firm, invoice: invoice(), lines, recipient: { email: "george@example.com", phone: "0433 932 877" } }).billTo;
    assert.ok(block.includes("george@example.com"));
    assert.ok(block.includes("0433 932 877"));
  });

  // Typed into the address block and held on the client record, they are
  // the same contact details — printing them twice makes the invoice
  // look automated and careless.
  test("contact details already typed in are not repeated", () => {
    const typed = invoice({ bill_to: "The Granny Flat Experts\ngeorge@example.com\n0433932877" });
    const block = invoiceView({ firm, invoice: typed, lines, recipient: { email: "GEORGE@example.com", phone: "0433 932 877" } }).billTo;
    assert.equal(block.length, 3, `${block.join(" | ")} should not repeat the email or the phone`);
  });

  test("the firm's own block carries the address, the contacts and the ABN", () => {
    assert.deepEqual(view().firmLines, [
      "QP Certifiers Pty Ltd",
      "A: Suite 2/F1, 101 Rookwood Road,",
      "Yagoona NSW 2199",
      "M: 0404 940 898",
      "E: info@qpcertifiers.com.au",
      "ABN: 41 630 945 416",
    ]);
  });

  test("the figure owed and the day it is owed by lead the document", () => {
    const { headline } = view();
    assert.equal(headline.label, "Amount due");
    assert.equal(headline.value, "$1,540.00", "GST added at a tenth");
    assert.equal(headline.dueValue, "08 Sept 2026");
  });

  test("the totals name the GST, as a tax invoice must", () => {
    assert.deepEqual(
      view().totals.map((t) => `${t.label} ${t.value}`),
      ["Subtotal $1,400.00", "Total GST 10% $140.00", "Total $1,540.00", "Amount due $1,540.00"]
    );
  });

  test("an open invoice declares no status at all", () => {
    assert.equal(view().status, null);
  });

  // Money that has already arrived must never be asked for a second
  // time, and a cancelled invoice must not read as a bill.
  test("a paid invoice says paid, and asks for nothing further", () => {
    const paid = view(invoice({ status: "paid", paid_date: "2026-09-08", stripe_payment_link_url: "https://pay/1" }));
    assert.equal(paid.headline.label, "Amount paid");
    assert.equal(paid.status?.text, "Paid 08 Sept 2026");
    assert.equal(paid.payUrl, null, "no pay button on a settled invoice");
  });

  test("a void invoice shows no amount and no due date", () => {
    const voided = view(invoice({ status: "void" }));
    assert.equal(voided.headline.value, "—");
    assert.equal(voided.headline.dueValue, "—");
    assert.equal(voided.status?.text, "Void — this invoice has been cancelled");
  });

  test("a missing due date reads as a dash, not as a scheduling note", () => {
    assert.equal(view(invoice({ due_date: null })).headline.dueValue, "—");
  });

  test("the reference is only a fact when there is one", () => {
    assert.deepEqual(view().facts.map((f) => f.label), ["Issue date", "Invoice number", "Reference"]);
    assert.deepEqual(view(invoice({ reference: null })).facts.map((f) => f.label), ["Issue date", "Invoice number"]);
  });

  test("the card surcharge is spelled out with the total it makes", () => {
    const carded = view(invoice({ stripe_payment_link_url: "https://pay/1", card_surcharge: 27.72 }));
    assert.ok(carded.surcharge?.includes("$27.72"));
    assert.ok(carded.surcharge?.includes("$1,567.72"), "what the card is actually charged");
  });
});

describe("the books", () => {
  // "Bill to" is a whole address block now, and Xero matches contacts by
  // name: the street would arrive as a contact of its own.
  test("Xero gets the contact's name, not their postal address", () => {
    assert.equal(
      contactNameFor({ ...invoice(), client_name: "George Haddad", invoice_lines: [] } as never),
      "The Granny Flat Experts, ABN: 29 155 078 014"
    );
  });
});
