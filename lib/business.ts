// Business-logic helpers ported from certflow-client-portal.jsx.
// These are pure functions — same behaviour, new home.

export function today() {
  return new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
export function formatISODate(iso?: string | null) {
  if (!iso) return "Not yet scheduled";
  const dt = new Date(`${iso}T00:00:00`);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export type ChecklistItemLike = {
  status: "requested" | "submitted" | "approved";
  amendments?: { resolved: boolean }[];
};

export function stageComplete(items: ChecklistItemLike[]) {
  return items.length > 0 && items.every((i) => i.status === "approved");
}
export function unresolvedCount(item: ChecklistItemLike) {
  return (item.amendments || []).filter((a) => !a.resolved).length;
}
export function displayStatus(item: ChecklistItemLike) {
  const n = unresolvedCount(item);
  if (item.status === "requested") return { dot: "bg-slate-300", label: "Requested" };
  if (n > 0) return { dot: "bg-amber-500", label: `Amendment needed (${n})` };
  if (item.status === "approved") return { dot: "bg-emerald-600", label: "Approved" };
  return { dot: "bg-blue-500", label: "Submitted — awaiting review" };
}
export function checklistProgress(items: ChecklistItemLike[]) {
  if (items.length === 0) return null;
  const done = items.filter((i) => i.status === "approved").length;
  return `${done}/${items.length}`;
}

export function inspectionsComplete(outcomes: string[]) {
  return outcomes.length > 0 && outcomes.every((o) => o === "passed" || o === "passed_subject_to");
}
export function inspectionProgress(outcomes: string[]) {
  if (outcomes.length === 0) return null;
  const done = outcomes.filter((o) => o === "passed" || o === "passed_subject_to").length;
  return `${done}/${outcomes.length}`;
}

export function addYears(dateStr?: string | null, years = 0) {
  if (!dateStr) return "";
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return "";
  dt.setFullYear(dt.getFullYear() + years);
  return dt.toISOString().slice(0, 10);
}

// Auto-calculated CDC lapse date: always 5 years from the date of
// determination, unless work has commenced (NOC checklist fully approved)
// and at least one inspection has passed/failed/passed-subject-to — in
// which case there's no fixed lapse date (the certificate has already been
// acted upon). Build Brief §3: verify against actual NSW practice before
// relying on this in production.
export function calcCdcLapseDate(
  pathway: "CDC" | "CC",
  determinationDate: string | null | undefined,
  nocItems: ChecklistItemLike[],
  inspectionOutcomes: string[]
) {
  if (pathway !== "CDC") return "";
  const nocApproved = stageComplete(nocItems);
  const anyInspectionActed = inspectionOutcomes.some((o) => o === "passed" || o === "failed" || o === "passed_subject_to");
  if (nocApproved && anyInspectionActed) return "N/A — construction commenced";
  return addYears(determinationDate, 5) || "";
}

export function daysUntil(isoDate?: string | null) {
  if (!isoDate) return null;
  const dt = new Date(`${isoDate}T00:00:00`);
  if (isNaN(dt.getTime())) return null;
  return Math.ceil((dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Inspection booking rules (Build Brief §15). The Postgres functions
// earliest_bookable_inspection_date / client_book_inspection in the
// migration are the source of truth enforced server-side; these mirror the
// same rules client-side purely so the UI can suggest a valid date before
// the server call, and show the "why" to the client immediately.
// ---------------------------------------------------------------------------

function pushOffWeekend(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 3);
  else if (day === 0) d.setDate(d.getDate() + 2);
  return d;
}
export function earliestBookableInspectionDate(now = new Date()) {
  const nowDay = now.getDay();
  if (nowDay === 6 || nowDay === 0) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (nowDay === 6 ? 3 : 2));
    return d;
  }
  const leadDays = now.getHours() >= 14 ? 2 : 1;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + leadDays);
  return pushOffWeekend(d);
}
function toISODateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function isValidInspectionBookingDate(isoDateStr: string, now = new Date()) {
  if (!isoDateStr) return false;
  const picked = new Date(isoDateStr + "T00:00:00");
  const day = picked.getDay();
  if (day === 0 || day === 6) return false;
  const earliest = earliestBookableInspectionDate(now);
  return picked >= earliest;
}
export function suggestedInspectionBookingDate(isoDateStr: string, now = new Date()) {
  const earliest = earliestBookableInspectionDate(now);
  if (!isoDateStr) return toISODateOnly(earliest);
  const picked = new Date(isoDateStr + "T00:00:00");
  const adjusted = pushOffWeekend(picked < earliest ? earliest : picked);
  return toISODateOnly(adjusted);
}

export function pathwayCertRef(pathway: "CDC" | "CC", projectNumberOrId: string, version: number) {
  return `${pathway}-${projectNumberOrId}/${String(version || 1).padStart(2, "0")}`;
}

// Build Brief §9: CDC/CC/OC issuance and critical stage inspections must be
// reported to the NSW Planning Portal within 2 business days of the event.
// Returns the ISO deadline date (business days only, weekends skipped).
export function portalReportDeadline(eventDateIso: string) {
  const d = new Date(`${eventDateIso}T00:00:00`);
  let remaining = 2;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return d.toISOString().slice(0, 10);
}
