import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { invoiceTotals, isOverdue, nextInvoiceNumber, invoiceNumberOf, receivablesSummary, formatMoney } from "@/lib/invoices/invoiceLogic";

// Money is the one place a rounding quirk becomes a phone call from an
// accountant. The arithmetic, the numbering series and the meaning of
// "overdue" are pinned down here.

describe("invoice totals", () => {
  test("adds GST at exactly one tenth", () => {
    const { subtotal, gst, total } = invoiceTotals([{ amount: 1500 }, { amount: 350.5 }]);
    assert.equal(subtotal, 1850.5);
    assert.equal(gst, 185.05);
    assert.equal(total, 2035.55);
  });

  // 0.1 * 330 is 33.000000000000004 in floating point; the GST must come
  // out as printed currency, not as what a float happens to hold.
  test("GST lands on the cent", () => {
    assert.equal(invoiceTotals([{ amount: 330 }]).gst, 33);
    assert.equal(formatMoney(invoiceTotals([{ amount: 330 }]).total), "$363.00");
  });

  test("an empty invoice owes nothing", () => {
    assert.deepEqual(invoiceTotals([]), { subtotal: 0, gst: 0, total: 0 });
  });
});

describe("the INV- series", () => {
  test("continues one past the highest number used", () => {
    assert.equal(nextInvoiceNumber(["INV-0001", "INV-0007", "INV-0003"]), "INV-0008");
  });

  // Counting rows would reuse a number after a void or a manual
  // renumber; the series must never go backwards.
  test("ignores blanks, manual numbers and other series", () => {
    assert.equal(nextInvoiceNumber([null, "", "QP-2026-1", "INV-0002"]), "INV-0003");
    assert.equal(nextInvoiceNumber([]), "INV-0001");
  });

  test("a typed number prints as typed; a blank one falls back to the id", () => {
    assert.equal(invoiceNumberOf({ invoice_number: "QP-114", id: "abcdef12-0000" }), "QP-114");
    assert.equal(invoiceNumberOf({ invoice_number: null, id: "abcdef12-0000" }), "ABCDEF12");
  });
});

describe("overdue and the owed totals", () => {
  const today = "2026-08-26";

  test("overdue means sent and past due — nothing else", () => {
    assert.equal(isOverdue({ status: "sent", due_date: "2026-08-20" }, today), true);
    assert.equal(isOverdue({ status: "sent", due_date: "2026-08-26" }, today), false);
    assert.equal(isOverdue({ status: "paid", due_date: "2026-08-20" }, today), false);
    assert.equal(isOverdue({ status: "draft", due_date: "2026-08-20" }, today), false);
    assert.equal(isOverdue({ status: "sent", due_date: null }, today), false);
  });

  test("only sent invoices count as owed; drafts, paid and void do not", () => {
    const summary = receivablesSummary(
      [
        { status: "sent", due_date: "2026-09-01", total: 1000 },
        { status: "sent", due_date: "2026-08-01", total: 500 },
        { status: "paid", due_date: "2026-08-01", total: 999 },
        { status: "draft", due_date: null, total: 999 },
        { status: "void", due_date: "2026-08-01", total: 999 },
      ],
      today
    );
    assert.equal(summary.outstanding, 1500);
    assert.equal(summary.overdue, 500);
    assert.equal(summary.overdueCount, 1);
  });
});
