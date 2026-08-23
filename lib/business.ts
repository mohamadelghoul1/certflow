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
  // Some columns are plain dates ("2026-08-22") and others are full
  // timestamps ("2026-08-22T04:19:03.123Z") — signed_at and its siblings
  // are the latter. Appending T00:00:00 to a timestamp produced nonsense
  // that failed to parse, and the fallback then printed the raw value,
  // which is how a time of day ended up on the approval stamp. Taking the
  // date part first handles both.
  const datePart = iso.slice(0, 10);
  const dt = new Date(`${datePart}T00:00:00`);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export type ChecklistItemLike = {
  status: "requested" | "submitted" | "approved";
  amendments?: { resolved: boolean }[];
};

// The firm's postal and office addresses are stored as one string, but on
// the letterhead the suburb belongs on its own line under the street — a
// single long line pushes the contact block out of shape, especially in
// Word where the header has less room than the browser gives it. Split at
// the last comma, which is where "…, Yagoona NSW 2199" always begins.
export function letterheadAddressLines(address?: string | null): string[] {
  const value = (address || "").trim();
  if (!value) return ["—"];
  const cut = value.lastIndexOf(",");
  if (cut === -1) return [value];
  const street = value.slice(0, cut).trim();
  const locality = value.slice(cut + 1).trim();
  return street && locality ? [`${street},`, locality] : [value];
}

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
  // Names who the document is waiting on. "Awaiting review" alone left it
  // unclear whether the client still owed something or the certifier did —
  // and this label is read by both of them, in the checklist and in the
  // client's own portal.
  return { dot: "bg-blue-500", label: "Submitted — awaiting certifier review" };
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

// A firm that numbers its jobs "CDC-26001" would otherwise get the pathway
// prepended a second time, and every certificate, letter and download would
// read "CDC-CDC-26001/01". Where the project number already leads with the
// pathway it is used as it stands. Only a real prefix counts — the pathway
// followed by a separator, with something after it — so a project number
// like "CCTV-12" is left alone, and "CDC-" on its own still gets a
// reference rather than being stripped down to nothing.
function withoutPathwayPrefix(prefix: string, projectNumberOrId: string) {
  const trimmed = (projectNumberOrId || "").trim();
  const match = new RegExp(`^${prefix}[-_ ]+(?=.)`, "i").exec(trimmed);
  return match ? trimmed.slice(match[0].length) : trimmed;
}

export function pathwayCertRef(pathway: "CDC" | "CC", projectNumberOrId: string, version: number) {
  return `${pathway}-${withoutPathwayPrefix(pathway, projectNumberOrId)}/${String(version || 1).padStart(2, "0")}`;
}

// A certifier can override the generated reference per version / per OC
// record (see migration 0012). Everything that displays or prints a
// reference goes through these so a custom one is honoured consistently —
// on the cards, the certificates, the letters and the inspection reports —
// rather than only in the one place it was typed. Blank or whitespace-only
// falls back to the generated reference.
export function resolvePathwayCertRef(customRef: string | null | undefined, pathway: "CDC" | "CC", projectNumberOrId: string, version: number) {
  return customRef?.trim() || pathwayCertRef(pathway, projectNumberOrId, version);
}

// sequence = this OC's 1-based position among every OC issued for the job
// (partial and whole together), oldest first.
export function ocCertRef(projectNumberOrId: string, sequence: number) {
  return `OC-${withoutPathwayPrefix("OC", projectNumberOrId)}/${String(sequence || 1).padStart(2, "0")}`;
}

export function resolveOcCertRef(customRef: string | null | undefined, projectNumberOrId: string, sequence: number) {
  return customRef?.trim() || ocCertRef(projectNumberOrId, sequence);
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
