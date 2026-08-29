import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { invoiceEmailHtml } from "@/lib/invoices/invoiceEmail";
import { formatISODate } from "@/lib/business";
import type { InvoiceLine } from "@/types/db";

// The one document a client is asked to act on. It goes out under the
// firm's own name, so a mistake in it is a mistake in front of a paying
// customer.

const LINES = [{ description: "Construction certificate", amount: 1400 }] as unknown as InvoiceLine[];

function html(overrides: Partial<Parameters<typeof invoiceEmailHtml>[0]> = {}) {
  return invoiceEmailHtml({
    clientName: "Mark",
    invoiceNumber: "INV-0004",
    reference: "12 Example St",
    lines: LINES,
    dueDate: "2026-09-12",
    paymentLinkUrl: null,
    cardSurcharge: null,
    paymentDetails: null,
    notes: null,
    portalUrl: "https://certlyn.example",
    firmName: "QP Certifiers Pty Ltd",
    ...overrides,
  });
}

describe("the invoice email a client receives", () => {
  // It used to print the raw database value, "2026-09-12", which reads
  // as a serial number rather than a date — and disagreed with the PDF
  // attached to the very same email, which has always been formatted.
  test("the due date is written the way it is on the attached PDF", () => {
    const body = html();
    // Asserted against the shared formatter rather than a literal, so
    // this cannot disagree with the PDF and the portal, which use the
    // same one. What matters is that the raw value never gets out.
    assert.ok(body.includes(`<strong>${formatISODate("2026-09-12")}</strong>`));
    assert.match(body, /Payment is due by <strong>\d{1,2} [A-Za-z]+ 2026<\/strong>/);
    assert.equal(body.includes("2026-09-12"), false, "the raw database date must never reach a client");
  });

  test("an invoice with no due date simply does not mention one", () => {
    const body = html({ dueDate: null });
    assert.equal(body.includes("Payment is due by"), false);
    assert.equal(body.includes("Not yet scheduled"), false, "an inspection's wording has no place on an invoice");
  });

  test("the totals are the invoice's own, GST included", () => {
    const body = html();
    assert.match(body, /Subtotal[\s\S]*\$1,400\.00/);
    assert.match(body, /GST \(10%\)[\s\S]*\$140\.00/);
    assert.match(body, /Total due[\s\S]*\$1,540\.00/);
  });

  test("the surcharge names both the extra and what it makes the total", () => {
    const body = html({ paymentLinkUrl: "https://pay.example/x", cardSurcharge: 26.9 });
    assert.match(body, /\$26\.90 processing surcharge/);
    assert.match(body, /total \$1,566\.90/);
  });

  // A description is typed by a certifier and could contain anything.
  test("a description cannot inject markup into the email", () => {
    const body = html({ lines: [{ description: '<script>alert(1)</script>', amount: 10 }] as unknown as InvoiceLine[] });
    assert.equal(body.includes("<script>"), false);
    assert.match(body, /&lt;script&gt;/);
  });

  test("it signs off as the firm, not as Certlyn", () => {
    assert.match(html(), /Kind regards,<br\/>QP Certifiers Pty Ltd/);
  });
});
