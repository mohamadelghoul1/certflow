import { createHash } from "node:crypto";
import type { ComplianceItem } from "@/lib/compliance";

// What the assistant is allowed to know when it writes the morning note.
//
// Everything here is read off the database and pre-digested: times are
// already in Sydney time and already say "yesterday", counts are already
// counted, deadlines already sorted. The model is handed a page of plain
// facts and asked to write them up, and nothing more — it never sees a
// row, and it never does arithmetic on a date, because a note that says
// "uploaded yesterday" when it was Friday is worse than no note.
//
// The same facts, written out by factsAsText, are the prompt and, when
// there is no AI key, the note itself. So the fallback is never a
// different answer — only a plainer one.

export type BriefingUpload = { jobId: string; address: string; title: string; stage: string; when: string; at: string };
export type BriefingReview = { jobId: string; address: string; count: number; titles: string[]; waitingDays: number | null };
export type BriefingOutstanding = { jobId: string; address: string; count: number; titles: string[] };
export type BriefingInspection = { jobId: string; address: string; title: string; date: string; when: string; daysAway: number };
export type BriefingBooking = { jobId: string; address: string; title: string; date: string };
export type BriefingReceivables = { outstanding: number; overdue: number; overdueCount: number };

export type BriefingFacts = {
  today: string;
  uploads: BriefingUpload[];
  awaitingReview: BriefingReview[];
  stillOutstanding: BriefingOutstanding[];
  bookingsToConfirm: BriefingBooking[];
  inspectionsAhead: BriefingInspection[];
  inspectionsUnrecorded: BriefingInspection[];
  deadlines: { title: string; detail: string; dueDate: string; severity: ComplianceItem["severity"] }[];
  receivables: BriefingReceivables | null;
};

// The rows the facts are read from — the shape the dashboard's own
// query returns, and no more.
export type BriefingJobRow = {
  id: string;
  address: string;
  pathway: string;
  checklists?:
    | {
        kind: string;
        checklist_items?:
          | {
              title: string;
              status: string;
              internal?: boolean | null;
              updated_at?: string | null;
              amendments?: { resolved: boolean }[] | null;
              checklist_item_files?: { created_at: string; uploaded_by_role: string }[] | null;
            }[]
          | null;
      }[]
    | null;
  inspections?: { id: string; title: string; date: string | null; outcome: string; booked_by_client: boolean; confirmed: boolean }[] | null;
};

const SYDNEY = "Australia/Sydney";

// Uploads older than this are yesterday's news, not this morning's. Four
// days rather than three so a Friday afternoon upload is still in
// Monday's note.
export const UPLOAD_WINDOW_HOURS = 96;
export const INSPECTION_HORIZON_DAYS = 3;

function sydneyDate(at: Date): string {
  return at.toLocaleDateString("en-CA", { timeZone: SYDNEY });
}

function sydneyTime(at: Date): string {
  return at.toLocaleTimeString("en-AU", { timeZone: SYDNEY, hour: "numeric", minute: "2-digit" }).replace(/\s?(am|pm)/i, " $1");
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime()) / 86400000);
}

// "today 3:40 pm", "yesterday 9:12 am", "Fri 29 Aug, 4:05 pm". Said in
// words here so the model repeats them rather than works them out.
export function whenLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  const gap = daysBetween(sydneyDate(at), sydneyDate(now));
  const time = sydneyTime(at);
  if (gap === 0) return `today ${time}`;
  if (gap === 1) return `yesterday ${time}`;
  // "Fri, 28 Aug" is how the runtime writes it; the comma after the day
  // name reads oddly before another comma.
  const day = at.toLocaleDateString("en-AU", { timeZone: SYDNEY, weekday: "short", day: "numeric", month: "short" }).replace(",", "");
  return `${day}, ${time}`;
}

export function dayLabel(dateIso: string, todayIso: string): string {
  const gap = daysBetween(todayIso, dateIso);
  if (gap === 0) return "today";
  if (gap === 1) return "tomorrow";
  if (gap === -1) return "yesterday";
  const day = new Date(`${dateIso}T00:00:00`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" }).replace(",", "");
  return gap > 0 ? `${day} (in ${gap} days)` : `${day} (${-gap} days ago)`;
}

function stageName(kind: string, pathway: string): string {
  if (kind === "pathway") return pathway === "PC_OC" ? "approval" : `${pathway} application`;
  if (kind === "noc") return "NOC";
  if (kind === "oc") return "OC";
  return "modification";
}

export function buildBriefingFacts(input: {
  jobs: BriefingJobRow[];
  compliance: ComplianceItem[];
  receivables: BriefingReceivables | null;
  now: Date;
}): BriefingFacts {
  const { now } = input;
  const todayIso = sydneyDate(now);
  const windowStart = now.getTime() - UPLOAD_WINDOW_HOURS * 3600 * 1000;

  const uploads: BriefingUpload[] = [];
  const awaitingReview: BriefingReview[] = [];
  const stillOutstanding: BriefingOutstanding[] = [];
  const bookingsToConfirm: BriefingBooking[] = [];
  const inspectionsAhead: BriefingInspection[] = [];
  const inspectionsUnrecorded: BriefingInspection[] = [];

  for (const job of input.jobs) {
    const review: string[] = [];
    let oldestReview: number | null = null;
    const outstanding: string[] = [];

    for (const checklist of job.checklists || []) {
      const stage = stageName(checklist.kind, job.pathway);
      for (const item of checklist.checklist_items || []) {
        for (const file of item.checklist_item_files || []) {
          if (file.uploaded_by_role !== "client") continue;
          const at = new Date(file.created_at).getTime();
          if (Number.isNaN(at) || at < windowStart) continue;
          uploads.push({ jobId: job.id, address: job.address, title: item.title, stage, when: whenLabel(file.created_at, now), at: file.created_at });
        }
        const sentBack = (item.amendments || []).some((a) => !a.resolved);
        if (item.status === "submitted" && !sentBack) {
          review.push(item.title);
          if (item.updated_at) {
            const days = daysBetween(sydneyDate(new Date(item.updated_at)), todayIso);
            oldestReview = oldestReview === null ? days : Math.max(oldestReview, days);
          }
        }
        if (!item.internal && (item.status === "requested" || sentBack)) outstanding.push(item.title);
      }
    }
    if (review.length > 0) awaitingReview.push({ jobId: job.id, address: job.address, count: review.length, titles: review, waitingDays: oldestReview });
    if (outstanding.length > 0) stillOutstanding.push({ jobId: job.id, address: job.address, count: outstanding.length, titles: outstanding });

    for (const inspection of job.inspections || []) {
      if (!inspection.date) continue;
      if (inspection.booked_by_client && !inspection.confirmed) {
        bookingsToConfirm.push({ jobId: job.id, address: job.address, title: inspection.title, date: inspection.date });
      }
      const daysAway = daysBetween(todayIso, inspection.date);
      const entry = { jobId: job.id, address: job.address, title: inspection.title, date: inspection.date, when: dayLabel(inspection.date, todayIso), daysAway };
      if (daysAway >= 0 && daysAway <= INSPECTION_HORIZON_DAYS) inspectionsAhead.push(entry);
      else if (daysAway < 0 && inspection.outcome === "pending") inspectionsUnrecorded.push(entry);
    }
  }

  uploads.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  inspectionsAhead.sort((a, b) => a.daysAway - b.daysAway);
  inspectionsUnrecorded.sort((a, b) => b.daysAway - a.daysAway);

  return {
    today: now.toLocaleDateString("en-AU", { timeZone: SYDNEY, weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    uploads,
    awaitingReview,
    stillOutstanding,
    bookingsToConfirm,
    inspectionsAhead,
    inspectionsUnrecorded,
    deadlines: input.compliance
      .filter((c) => c.severity !== "upcoming")
      .map((c) => ({ title: c.title, detail: c.detail, dueDate: c.dueDate, severity: c.severity })),
    receivables: input.receivables,
  };
}

// Nothing to say — every list empty and nothing owed. The note then
// says so in one line rather than inventing something.
export function isQuiet(facts: BriefingFacts): boolean {
  return (
    facts.uploads.length === 0 &&
    facts.awaitingReview.length === 0 &&
    facts.bookingsToConfirm.length === 0 &&
    facts.inspectionsAhead.length === 0 &&
    facts.inspectionsUnrecorded.length === 0 &&
    facts.deadlines.length === 0 &&
    !(facts.receivables && facts.receivables.overdueCount > 0)
  );
}

// A fingerprint of everything the note would be written from. The date
// is part of it, so the note is written fresh each day even when nothing
// moved — "yesterday" would otherwise be a day out by the second morning.
export function factsHash(facts: BriefingFacts): string {
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex").slice(0, 32);
}

function money(n: number): string {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// The facts as a page of text: what the model is given, and what the
// certifier reads when there is no model.
export function factsAsText(facts: BriefingFacts): string {
  const lines: string[] = [`Today is ${facts.today}.`];

  const section = (title: string, rows: string[]) => {
    if (rows.length === 0) return;
    lines.push("", `${title}:`);
    for (const row of rows) lines.push(`- ${row}`);
  };

  section(
    "Documents clients have uploaded recently (newest first)",
    facts.uploads.map((u) => `${u.address} [job ${u.jobId}]: "${u.title}" (${u.stage}) uploaded ${u.when}`)
  );
  section(
    "Documents waiting on the certifier to assess",
    facts.awaitingReview.map(
      (r) =>
        `${r.address} [job ${r.jobId}]: ${r.count} document${r.count === 1 ? "" : "s"} — ${r.titles.join("; ")}` +
        (r.waitingDays !== null && r.waitingDays > 0 ? ` (oldest waiting ${r.waitingDays} day${r.waitingDays === 1 ? "" : "s"})` : "")
    )
  );
  section(
    "Documents still to come from clients",
    facts.stillOutstanding.map((o) => `${o.address} [job ${o.jobId}]: ${o.count} still needed — ${o.titles.join("; ")}`)
  );
  section(
    "Inspection bookings from clients needing confirmation",
    facts.bookingsToConfirm.map((b) => `${b.address} [job ${b.jobId}]: ${b.title} on ${b.date}`)
  );
  section(
    "Inspections coming up",
    facts.inspectionsAhead.map((i) => `${i.address} [job ${i.jobId}]: ${i.title} ${i.when}`)
  );
  section(
    "Inspections that have passed with no result recorded",
    facts.inspectionsUnrecorded.map((i) => `${i.address} [job ${i.jobId}]: ${i.title} was ${i.when}`)
  );
  section(
    "Deadlines",
    facts.deadlines.map((d) => `${d.severity === "overdue" ? "OVERDUE" : "Due soon"}: ${d.title} — ${d.detail} (${d.dueDate})`)
  );
  if (facts.receivables && facts.receivables.outstanding > 0) {
    const r = facts.receivables;
    section("Money", [
      `${money(r.outstanding)} owed on invoices` + (r.overdueCount > 0 ? `, of which ${money(r.overdue)} is overdue on ${r.overdueCount} invoice${r.overdueCount === 1 ? "" : "s"}` : ""),
    ]);
  }

  if (lines.length === 1) lines.push("", "Nothing has come in, nothing is waiting, and nothing is due.");
  return lines.join("\n");
}
