import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chargeFor, monthNumber, monthKey, monthLabel, monthsSince, money, rateLabel, statementLines, usageCsv, DEFAULT_PLAN, type FirmPlan } from "@/lib/billing";

function plan(over: Partial<FirmPlan> = {}): FirmPlan {
  return {
    firm_id: "f1",
    started_on: "2026-09-15",
    intro_months: 6,
    intro_fee_cents: 9900,
    standard_fee_cents: 39900,
    included_projects: 30,
    extra_project_fee_cents: 2500,
    notes: null,
    ...over,
  };
}

// What a firm owes for a month.
describe("which month of the arrangement it is", () => {
  test("the month they started is the first, whatever day of it", () => {
    assert.equal(monthNumber("2026-09-15", "2026-09"), 1);
    assert.equal(monthNumber("2026-09-01", "2026-09"), 1);
    assert.equal(monthNumber("2026-09-30", "2026-09"), 1);
  });

  test("counts on through a year end", () => {
    assert.equal(monthNumber("2026-09-15", "2026-12"), 4);
    assert.equal(monthNumber("2026-09-15", "2027-02"), 6);
    assert.equal(monthNumber("2026-09-15", "2027-03"), 7);
  });

  test("is nothing before they started", () => {
    assert.equal(monthNumber("2026-09-15", "2026-08"), 0);
  });
});

describe("the bill", () => {
  test("is the introductory fee for the first six months", () => {
    const first = chargeFor(plan(), "2026-09", 10);
    assert.equal(first.intro, true);
    assert.equal(first.feeCents, 9900);
    assert.equal(first.totalCents, 9900);
    const sixth = chargeFor(plan(), "2027-02", 10);
    assert.equal(sixth.monthNumber, 6);
    assert.equal(sixth.intro, true, "the sixth month is still introductory");
    assert.equal(sixth.feeCents, 9900);
  });

  test("moves to the standard fee in the seventh", () => {
    const seventh = chargeFor(plan(), "2027-03", 10);
    assert.equal(seventh.monthNumber, 7);
    assert.equal(seventh.intro, false);
    assert.equal(seventh.feeCents, 39900);
  });

  test("charges nothing for projects up to the included number", () => {
    const exactly = chargeFor(plan(), "2026-09", 30);
    assert.equal(exactly.extra, 0);
    assert.equal(exactly.totalCents, 9900);
    const under = chargeFor(plan(), "2026-09", 4);
    assert.equal(under.extra, 0);
    assert.equal(under.totalCents, 9900);
  });

  test("charges per project past it", () => {
    const over = chargeFor(plan(), "2026-09", 34);
    assert.equal(over.extra, 4);
    assert.equal(over.extraCents, 10000);
    assert.equal(over.totalCents, 19900, "$99 plus four at $25");
  });

  test("charges nothing at all for a month before the firm started", () => {
    const before = chargeFor(plan(), "2026-08", 12);
    assert.equal(before.monthNumber, 0);
    assert.equal(before.feeCents, 0);
    assert.equal(before.extraCents, 0, "a project created before the arrangement is not billed under it");
    assert.equal(before.totalCents, 0);
  });

  test("respects terms that differ from the standard ones", () => {
    const bespoke = plan({ intro_months: 0, standard_fee_cents: 29900, included_projects: 50, extra_project_fee_cents: 1500 });
    const charge = chargeFor(bespoke, "2026-09", 52);
    assert.equal(charge.intro, false, "no introductory months means the standard rate from the start");
    assert.equal(charge.feeCents, 29900);
    assert.equal(charge.extra, 2);
    assert.equal(charge.totalCents, 32900);
  });

  test("the defaults are the terms being offered", () => {
    assert.equal(DEFAULT_PLAN.intro_fee_cents, 9900);
    assert.equal(DEFAULT_PLAN.intro_months, 6);
    assert.equal(DEFAULT_PLAN.included_projects, 30);
    assert.equal(DEFAULT_PLAN.extra_project_fee_cents, 2500);
  });
});

describe("how it reads", () => {
  test("money is money", () => {
    assert.equal(money(9900), "$99.00");
    assert.equal(money(0), "$0.00");
    assert.equal(money(1234567), "$12,345.67");
  });

  test("the rate says where in the arrangement they are", () => {
    assert.equal(rateLabel(chargeFor(plan(), "2026-11", 1), plan()), "Month 3 of 6 — introductory rate");
    assert.equal(rateLabel(chargeFor(plan(), "2027-04", 1), plan()), "Month 8 — standard rate");
  });

  test("the statement is one line, or two when they went over", () => {
    const within = statementLines(chargeFor(plan(), "2026-09", 12), plan());
    assert.equal(within.length, 1);
    assert.match(within[0].text, /includes 30 new projects/);
    const over = statementLines(chargeFor(plan(), "2026-09", 33), plan());
    assert.equal(over.length, 2);
    assert.match(over[1].text, /3 additional projects at \$25\.00/);
    assert.equal(over[1].cents, 7500);
  });

  test("a month is named the way it would be said", () => {
    assert.equal(monthLabel("2026-09"), "September 2026");
  });

  test("the month list runs newest first and includes both ends", () => {
    const months = monthsSince("2026-11", "2027-02");
    assert.deepEqual(months, ["2027-02", "2027-01", "2026-12", "2026-11"]);
    assert.deepEqual(monthsSince("2026-09", "2026-09"), ["2026-09"]);
  });

  test("the month key is Sydney's month, not UTC's", () => {
    // 1 October 2026, 00:30 Sydney — still 30 September in UTC.
    assert.equal(monthKey(new Date("2026-09-30T14:30:00Z")), "2026-10");
  });
});

describe("the spreadsheet", () => {
  test("carries a line per firm with the amounts as plain numbers", () => {
    const firm = { firm_id: "f1", firm_name: "Example Certifiers", created_on: "2026-09-15", billable_projects: 33, imported_projects: 12, total_projects: 45 };
    const csv = usageCsv([{ firm, plan: plan(), charge: chargeFor(plan(), "2026-09", 33) }], "2026-09");
    const [head, row] = csv.split("\n");
    assert.match(head, /^Month,Firm,New projects/);
    assert.equal(row, "2026-09,Example Certifiers,33,12,30,3,99.00,75.00,174.00");
  });

  test("quotes a firm name containing a comma", () => {
    const firm = { firm_id: "f1", firm_name: "Smith, Jones & Co", created_on: "2026-09-15", billable_projects: 1, imported_projects: 0, total_projects: 1 };
    const csv = usageCsv([{ firm, plan: null, charge: null }], "2026-09");
    assert.match(csv.split("\n")[1], /"Smith, Jones & Co"/);
  });
});
