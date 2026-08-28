import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { xeroInvoiceCsv, contactNameFor, XERO_COLUMNS, type XeroInvoice } from "@/lib/invoices/xeroCsv";

const OPTIONS = { accountCode: "200", taxType: "OUTPUT" };

function invoice(over: Partial<XeroInvoice> = {}): XeroInvoice {
  return {
    id: "3f6d9a20-0000-0000-0000-000000000000",
    invoice_number: "INV-0007",
    issue_date: "2026-08-14",
    due_date: "2026-08-28",
    bill_to: "Jane Nguyen",
    reference: "21 Coquet Way, Green Valley",
    status: "sent",
    client_name: "Nguyen Developments",
    client_email: "jane@example.com",
    lines: [
      { description: "Complying Development Certificate", quantity: "1", amount: 2500, sort_order: 0 },
      { description: "Principal Certifier appointment", quantity: "1", amount: 1500, sort_order: 1 },
    ],
    ...over,
  };
}

// A real reader, not a split on commas: half the point of the file is
// that an address or a description containing a comma stays in one
// field, and a test that split naively would pass whether or not that
// worked.
function rows(csv: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && csv[i + 1] === "\n") {
      row.push(field);
      out.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += c;
    }
  }
  row.push(field);
  out.push(row);
  return out;
}

describe("the Xero import file", () => {
  test("uses Xero's own column names, in its order", () => {
    const [header] = rows(xeroInvoiceCsv([invoice()], OPTIONS));
    assert.deepEqual(header, [...XERO_COLUMNS]);
    assert.equal(header[0], "*ContactName");
    assert.equal(header[7], "*InvoiceNumber");
  });

  // Xero groups rows into invoices by the invoice number, so a
  // three-line invoice is three rows carrying the same number.
  test("one row per fee line, all under the same invoice number", () => {
    const body = rows(xeroInvoiceCsv([invoice()], OPTIONS)).slice(1);
    assert.equal(body.length, 2);
    assert.equal(body[0][7], "INV-0007");
    assert.equal(body[1][7], "INV-0007");
    assert.equal(body[0][11], "Complying Development Certificate");
    assert.equal(body[1][11], "Principal Certifier appointment");
  });

  // Fees are held and printed excluding GST — the invoice adds a tenth
  // at the bottom. Sending tax-inclusive amounts would overstate every
  // invoice in the books by 10%.
  test("sends the amount excluding GST, and lets Xero add it", () => {
    const body = rows(xeroInvoiceCsv([invoice()], OPTIONS)).slice(1);
    assert.equal(body[0][13], "2500.00");
    assert.equal(body[0][15], "OUTPUT", "the tax type Xero adds GST from");
    assert.equal(body[0][14], "200");
  });

  test("a quantity of more than one becomes a unit price, not a total", () => {
    const csv = xeroInvoiceCsv([invoice({ lines: [{ description: "Inspections", quantity: "4", amount: 1000, sort_order: 0 }] })], OPTIONS);
    const [line] = rows(csv).slice(1);
    assert.equal(line[12], "4");
    assert.equal(line[13], "250.00", "1000 across four inspections is 250 each");
  });

  test("a firm with its own chart of accounts gets its own codes", () => {
    const [line] = rows(xeroInvoiceCsv([invoice()], { accountCode: "4100", taxType: "EXEMPTOUTPUT" })).slice(1);
    assert.equal(line[14], "4100");
    assert.equal(line[15], "EXEMPTOUTPUT");
  });

  // Xero matches an existing contact by name, so it has to be the name
  // the books already know.
  test("bills to the name on the invoice, then the client record", () => {
    assert.equal(contactNameFor(invoice()), "Jane Nguyen");
    assert.equal(contactNameFor(invoice({ bill_to: null })), "Nguyen Developments");
    assert.equal(contactNameFor(invoice({ bill_to: null, client_name: null })), "Unknown contact");
  });

  // Left out of the file, an empty invoice silently goes missing from
  // the books; nobody notices a number that was never there.
  test("an invoice with no fee lines still appears, at zero", () => {
    const body = rows(xeroInvoiceCsv([invoice({ lines: [] })], OPTIONS)).slice(1);
    assert.equal(body.length, 1);
    assert.equal(body[0][13], "0.00");
  });

  test("a due date is never blank — Xero requires one", () => {
    const [line] = rows(xeroInvoiceCsv([invoice({ due_date: null })], OPTIONS)).slice(1);
    assert.equal(line[10], "2026-08-14", "falls back to the issue date");
  });

  // A description or an address is typed by a person and can contain
  // anything, including the character that separates the columns.
  test("a comma or a quote in a description cannot break the columns", () => {
    const csv = xeroInvoiceCsv([invoice({ lines: [{ description: 'CDC, CC and "PC" appointment', quantity: "1", amount: 100, sort_order: 0 }] })], OPTIONS);
    assert.ok(csv.includes('"CDC, CC and ""PC"" appointment"'), "quoted and doubled in the file itself");
    const [line] = rows(csv).slice(1);
    assert.equal(line.length, XERO_COLUMNS.length, "still exactly one field per column");
    assert.equal(line[11], 'CDC, CC and "PC" appointment', "and it reads back as it was typed");
    assert.equal(line[8], "21 Coquet Way, Green Valley", "the address keeps its comma too");
  });

  test("an invoice with no number of its own still exports with one", () => {
    const [line] = rows(xeroInvoiceCsv([invoice({ invoice_number: null })], OPTIONS)).slice(1);
    assert.equal(line[7], "3F6D9A20", "derived from the invoice's id, as it prints");
  });
});
