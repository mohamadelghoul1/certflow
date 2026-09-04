// What a firm owes for a month.
//
// Certlyn is sold as a monthly fee covering a number of new projects,
// with a per-project charge past that, and an introductory rate for the
// first months of an arrangement. The terms are per firm (migration
// 0076) rather than assumed, because a firm signed up in March on
// different terms should keep them.
//
// Everything here is arithmetic on numbers the database already holds.
// Nothing here charges anybody: it is what the owner reads to raise an
// invoice, and what a firm sees so a bill is never a surprise.

export type FirmPlan = {
  firm_id: string;
  started_on: string;
  intro_months: number;
  intro_fee_cents: number;
  standard_fee_cents: number;
  included_projects: number;
  extra_project_fee_cents: number;
  notes: string | null;
};

// What a firm gets before one is set up for them, and what the terms
// default to when the owner adds one. Kept beside the maths so a change
// of policy is one edit.
export const DEFAULT_PLAN = {
  intro_months: 6,
  intro_fee_cents: 9900,
  standard_fee_cents: 39900,
  included_projects: 30,
  extra_project_fee_cents: 2500,
};

export type MonthCharge = {
  monthKey: string;
  // 1 for the first month of the arrangement. 0 before it starts.
  monthNumber: number;
  intro: boolean;
  feeCents: number;
  included: number;
  used: number;
  extra: number;
  extraCents: number;
  totalCents: number;
};

// "2026-09" — the calendar month a project is counted in, in Sydney
// time. A firm's month is the month they are living in, not UTC's.
export function monthKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  return `${year}-${month}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-AU", { timeZone: "UTC", month: "long", year: "numeric" });
}

// The months from a start date up to and including now, newest first —
// what the month picker offers.
export function monthsSince(startKey: string, endKey: string): string[] {
  const [sy, sm] = startKey.split("-").map(Number);
  const [ey, em] = endKey.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return [endKey];
  const out: string[] = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); ) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 240) break;
  }
  return out.reverse();
}

// Which month of the arrangement this is. 1 is the month the firm
// started, whatever day of it they started on — a firm joining on the
// 28th does not get a month for three days.
export function monthNumber(startedOn: string, key: string): number {
  const start = startedOn.slice(0, 7);
  const [sy, sm] = start.split("-").map(Number);
  const [ky, km] = key.split("-").map(Number);
  if (!sy || !sm || !ky || !km) return 0;
  const diff = (ky - sy) * 12 + (km - sm);
  return diff < 0 ? 0 : diff + 1;
}

// The bill for one month: the fee at the rate that month falls under,
// plus anything past what the fee covers.
export function chargeFor(plan: FirmPlan, key: string, used: number): MonthCharge {
  const number = monthNumber(plan.started_on, key);
  const started = number > 0;
  const intro = started && number <= plan.intro_months;
  const feeCents = !started ? 0 : intro ? plan.intro_fee_cents : plan.standard_fee_cents;
  const included = plan.included_projects;
  const extra = Math.max(0, used - included);
  const extraCents = started ? extra * plan.extra_project_fee_cents : 0;
  return {
    monthKey: key,
    monthNumber: number,
    intro,
    feeCents,
    included,
    used,
    extra,
    extraCents,
    totalCents: feeCents + extraCents,
  };
}

export function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// How the month reads on the statement: "Month 3 of 6 at the
// introductory rate", or what follows it.
export function rateLabel(charge: MonthCharge, plan: FirmPlan): string {
  if (charge.monthNumber === 0) return "Before this firm started";
  if (charge.intro) return `Month ${charge.monthNumber} of ${plan.intro_months} — introductory rate`;
  return `Month ${charge.monthNumber} — standard rate`;
}

// A statement line a person can read, for the invoice the owner raises
// by hand. Deliberately plain: the fee, then what went past it.
export function statementLines(charge: MonthCharge, plan: FirmPlan): { text: string; cents: number }[] {
  const lines: { text: string; cents: number }[] = [];
  if (charge.feeCents > 0) {
    lines.push({ text: `Certlyn subscription — ${monthLabel(charge.monthKey)} (includes ${charge.included} new projects)`, cents: charge.feeCents });
  }
  if (charge.extra > 0) {
    lines.push({
      text: `${charge.extra} additional project${charge.extra === 1 ? "" : "s"} at ${money(plan.extra_project_fee_cents)}`,
      cents: charge.extraCents,
    });
  }
  return lines;
}

// One row of the owner's month view.
export type FirmUsageRow = {
  firm_id: string;
  firm_name: string;
  created_on: string;
  billable_projects: number;
  imported_projects: number;
  total_projects: number;
};

export function planFor(rows: FirmPlan[], firmId: string): FirmPlan | null {
  return rows.find((p) => p.firm_id === firmId) || null;
}

// The spreadsheet the owner's bookkeeper wants: one line per firm.
export function usageCsv(rows: { firm: FirmUsageRow; plan: FirmPlan | null; charge: MonthCharge | null }[], key: string): string {
  const head = ["Month", "Firm", "New projects", "Imported (not charged)", "Included", "Over", "Fee", "Extra", "Total"];
  const body = rows.map(({ firm, charge }) => [
    key,
    firm.firm_name,
    String(firm.billable_projects),
    String(firm.imported_projects),
    charge ? String(charge.included) : "",
    charge ? String(charge.extra) : "",
    charge ? (charge.feeCents / 100).toFixed(2) : "",
    charge ? (charge.extraCents / 100).toFixed(2) : "",
    charge ? (charge.totalCents / 100).toFixed(2) : "",
  ]);
  return [head, ...body].map((r) => r.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")).join("\n");
}
