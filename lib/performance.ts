import type { SupabaseClient } from "@supabase/supabase-js";

// Two numbers a firm runs on and Certlyn has never shown: how long a
// certificate takes, and how much work the quotes actually win.
//
// Both are worked out from what is already recorded. Nothing new has to
// be typed, which is the only reason a measure like this survives — one
// that needs a field filled in is one that stops being true by March.

// ---------------------------------------------------------------------
// Turnaround: application received to certificate issued.
// ---------------------------------------------------------------------

export type TurnaroundJob = {
  id: string;
  address: string;
  pathway: string;
  // When the file arrived. The application date recorded against the
  // job, falling back to when the project was created here.
  received: string;
  issued: string;
  certifier: string | null;
};

export type TurnaroundSummary = {
  jobs: (TurnaroundJob & { days: number })[];
  count: number;
  median: number | null;
  fastest: number | null;
  slowest: number | null;
  // The proportion issued inside a fortnight — the promise most firms
  // make, and the one clients remember.
  withinFortnight: number | null;
};

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(...(fromIso.split("-").map(Number) as [number, number, number]));
  const to = Date.UTC(...(toIso.split("-").map(Number) as [number, number, number]));
  return Math.round((to - from) / 86_400_000);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  // An even count takes the mean of the two middle values, rounded to a
  // whole day — half a day of turnaround is not a real distinction.
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

// The median rather than the average, deliberately: one job that sat
// waiting on a client for four months would drag an average somewhere
// that describes no real job.
export function summariseTurnaround(jobs: TurnaroundJob[]): TurnaroundSummary {
  const withDays = jobs
    .map((job) => ({ ...job, days: daysBetween(job.received, job.issued) }))
    // A negative span means the dates were entered the wrong way round;
    // it says nothing about how long the work took.
    .filter((job) => job.days >= 0)
    .sort((a, b) => b.issued.localeCompare(a.issued));

  const days = withDays.map((j) => j.days);
  return {
    jobs: withDays,
    count: withDays.length,
    median: median(days),
    fastest: days.length ? Math.min(...days) : null,
    slowest: days.length ? Math.max(...days) : null,
    withinFortnight: days.length ? Math.round((days.filter((d) => d <= 14).length / days.length) * 100) : null,
  };
}

// ---------------------------------------------------------------------
// Conversion: quotes sent, quotes won.
// ---------------------------------------------------------------------

export type ConversionQuote = { id: string; status: string; total: number; created_at: string; address: string };

export type ConversionSummary = {
  sent: number;
  accepted: number;
  declined: number;
  awaiting: number;
  rate: number | null;
  valueWon: number;
  valueLost: number;
  valueAwaiting: number;
};

// A draft is not a quote until it has been sent, so drafts are left out
// of both halves of the fraction. Counting them would make a firm that
// writes a lot of drafts look like a firm that loses a lot of work.
export function summariseConversion(quotes: ConversionQuote[]): ConversionSummary {
  const live = quotes.filter((q) => q.status !== "draft");
  const accepted = live.filter((q) => q.status === "accepted");
  const declined = live.filter((q) => q.status === "declined");
  const awaiting = live.filter((q) => q.status === "sent");
  const decided = accepted.length + declined.length;

  const value = (rows: ConversionQuote[]) => rows.reduce((sum, q) => sum + (Number(q.total) || 0), 0);

  return {
    sent: live.length,
    accepted: accepted.length,
    declined: declined.length,
    awaiting: awaiting.length,
    // Measured against what has been decided: a quote still sitting with
    // a client is not a loss yet, and counting it as one understates
    // every firm that quotes steadily.
    rate: decided > 0 ? Math.round((accepted.length / decided) * 100) : null,
    valueWon: value(accepted),
    valueLost: value(declined),
    valueAwaiting: value(awaiting),
  };
}

// ---------------------------------------------------------------------
// Reading the two from the database.
// ---------------------------------------------------------------------

type JobRow = {
  id: string;
  address: string;
  pathway: string;
  created_at: string;
  pathway_generated_date: string | null;
  details: { preInspection?: { applicationDate?: string } } | null;
  certifiers: { name: string } | null;
};

export async function getTurnaround(supabase: SupabaseClient, firmId: string, from: string, to: string): Promise<TurnaroundSummary> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, address, pathway, created_at, pathway_generated_date, details, certifiers:pathway_issued_by(name)")
    .eq("firm_id", firmId)
    .eq("pathway_generated", true)
    .not("pathway_generated_date", "is", null)
    .gte("pathway_generated_date", from)
    .lte("pathway_generated_date", to);
  if (error) return summariseTurnaround([]);

  const jobs: TurnaroundJob[] = ((data || []) as unknown as JobRow[]).map((row) => ({
    id: row.id,
    address: row.address,
    pathway: row.pathway,
    received: row.details?.preInspection?.applicationDate || row.created_at.slice(0, 10),
    issued: row.pathway_generated_date!,
    certifier: row.certifiers?.name || null,
  }));

  return summariseTurnaround(jobs);
}

export async function getConversion(supabase: SupabaseClient, firmId: string, from: string, to: string): Promise<ConversionSummary> {
  const { data, error } = await supabase
    .from("quotes")
    .select("id, status, created_at, proposal_address, quote_fee_lines(amount)")
    .eq("firm_id", firmId)
    .gte("created_at", from)
    .lte("created_at", `${to}T23:59:59`);
  if (error) return summariseConversion([]);

  const quotes: ConversionQuote[] = ((data || []) as unknown as { id: string; status: string; created_at: string; proposal_address: string | null; quote_fee_lines: { amount: number }[] }[]).map(
    (row) => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      address: row.proposal_address || "",
      total: (row.quote_fee_lines || []).reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    })
  );

  return summariseConversion(quotes);
}
