// What an inspector needs to see when they open the app in the van.
//
// Not "every inspection on every job" — that list is for the office. On
// site the question is only ever: what am I doing today, what is coming,
// and what did I say I would do and haven't. So the day's work is
// grouped by when, with anything overdue at the top, because an
// inspection whose date has passed with no outcome recorded is the one
// thing here that is actually wrong.

export type VisitInspection = {
  id: string;
  job_id: string;
  title: string;
  date: string | null;
  outcome: string;
  confirmed: boolean;
  booked_by_client: boolean;
  report_signed_at: string | null;
  address: string;
};

export type VisitGroup = { key: "overdue" | "today" | "tomorrow" | "soon"; label: string; inspections: VisitInspection[] };

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// An inspection still waiting for an outcome. Once one is recorded the
// visit has happened, whatever the date says.
export function stillToAttend(inspection: Pick<VisitInspection, "outcome">): boolean {
  return inspection.outcome === "pending";
}

// The next week of work, grouped. Anything dated further out is left off:
// it is not today's problem, and a screen used one-handed on a site
// should not need scrolling past a fortnight to reach this afternoon.
export function visitGroups(inspections: VisitInspection[], today: string, daysAhead = 7): VisitGroup[] {
  const pending = inspections.filter(stillToAttend).filter((i) => !!i.date);
  const horizon = addDays(today, daysAhead);

  const inWindow = (from: string, to: string) => pending.filter((i) => i.date! >= from && i.date! <= to);
  const byDateThenAddress = (a: VisitInspection, b: VisitInspection) => (a.date || "").localeCompare(b.date || "") || a.address.localeCompare(b.address);

  const groups: VisitGroup[] = [
    { key: "overdue", label: "Overdue", inspections: pending.filter((i) => i.date! < today).sort(byDateThenAddress) },
    { key: "today", label: "Today", inspections: inWindow(today, today).sort(byDateThenAddress) },
    { key: "tomorrow", label: "Tomorrow", inspections: inWindow(addDays(today, 1), addDays(today, 1)).sort(byDateThenAddress) },
    { key: "soon", label: "Later this week", inspections: inWindow(addDays(today, 2), horizon).sort(byDateThenAddress) },
  ];

  return groups.filter((g) => g.inspections.length > 0);
}

// What the site screen says an inspection is waiting on, in the order
// the work actually happens.
export type VisitStep = "outcome" | "sign" | "done";

export function nextStep(inspection: Pick<VisitInspection, "outcome" | "report_signed_at">): VisitStep {
  if (inspection.outcome === "pending") return "outcome";
  if (!inspection.report_signed_at) return "sign";
  return "done";
}

// A map link for the address, so the next stop is one tap rather than
// copy, switch app, paste.
export function directionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
