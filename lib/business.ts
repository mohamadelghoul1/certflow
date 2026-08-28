// Business-logic helpers ported from certflow-client-portal.jsx.
// These are pure functions — same behaviour, new home.

export function today() {
  return new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Today where the work is, as yyyy-mm-dd.
//
// A server in UTC is already "tomorrow" for most of a Sydney afternoon,
// so checking a date against toISOString() would reject an inspection
// recorded this afternoon as being in the future. NSW is the only place
// this app is used, so the check is made against the date there.
export function todayInNsw() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
// A document's own date — the date on a plan, a certificate, a report.
// Absent means the certifier hasn't recorded one, which on a printed
// schedule reads as an em dash beside the other blank columns.
// formatISODate's "Not yet scheduled" belongs to an inspection that has no
// date yet; on a list of approved documents it was nonsense.
export function formatDocumentDate(iso?: string | null) {
  return iso ? formatISODate(iso) : "—";
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

// Whether a stage is finished, for the green tab on the job page.
//
// Green means "there is nothing left to do here", which is a different
// question for each stage — a certificate is issued, a checklist is fully
// approved, every inspection has been carried out, an occupation
// certificate exists.
export function pathwayStageComplete(job: { pathway_generated?: boolean | null; pathway_signed_at?: string | null; pathway_approval_uploaded?: boolean | null }) {
  // Generated and signed — or replaced by a signed copy the certifier
  // uploaded, which is the same thing arriving a different way. A
  // generated but unsigned certificate is not issued: that distinction is
  // the whole reason the jobs list separates "to issue" from "issued".
  return !!job.pathway_generated && (!!job.pathway_signed_at || !!job.pathway_approval_uploaded);
}

// Every inspection carried out, whatever was found. A failed one is done
// — it happened — and the re-inspection it calls for is added to the
// list as a new inspection, which is pending and takes the stage back off
// green until it too is carried out.
export function inspectionsCarriedOut(outcomes: string[]) {
  return outcomes.length > 0 && outcomes.every((o) => o !== "pending");
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
  pathway: Pathway,
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
// Inspection booking rules.
//
// The Postgres functions earliest_bookable_inspection_date and
// client_book_inspection are the source of truth, enforced server-side.
// These mirror the same rules in the browser purely so the form can
// suggest a valid date before the server is asked, and explain why.
//
// The two copies must agree exactly. A suggestion the database then
// refuses is worse than no suggestion at all — the client picks a day,
// presses the button, and is told no by something they cannot see.
//
// Everything below works in Sydney time, whatever the clock on the
// visitor's own device says. A builder checking the portal from
// overseas is still booking a tradesman's morning in New South Wales.
// ---------------------------------------------------------------------------

const SUNDAY = 0;
const FRIDAY = 5;
const SATURDAY = 6;

// Ask before 1pm and tomorrow is available; ask after it and the
// earliest is the day after. Half a working day is the least notice an
// inspector can be given.
const BOOKING_CUTOFF_HOUR = 13;

// Today's date and hour where the work is, not where the browser is.
function sydneyNow(now: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

// Calendar arithmetic done in UTC on a plain date, so a daylight-saving
// changeover cannot turn "tomorrow" into today at 23:00.
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function dayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// A date landing on a weekend moves to the Tuesday, never the Monday —
// the same rule that sends a Friday enquiry to Tuesday, for the same
// reason: a Monday inspection would have to be arranged over a weekend
// nobody is working.
function pushOffWeekend(isoDate: string): string {
  const day = dayOfWeek(isoDate);
  if (day === SATURDAY) return addDays(isoDate, 3);
  if (day === SUNDAY) return addDays(isoDate, 2);
  return isoDate;
}

// The earliest day an inspection can be booked for, as a plain date.
export function earliestBookableInspectionDate(now = new Date()): string {
  const { date, hour } = sydneyNow(now);
  const today = dayOfWeek(date);

  // Friday and the weekend all point at the same Tuesday.
  if (today === FRIDAY) return addDays(date, 4);
  if (today === SATURDAY) return addDays(date, 3);
  if (today === SUNDAY) return addDays(date, 2);

  return pushOffWeekend(addDays(date, hour >= BOOKING_CUTOFF_HOUR ? 2 : 1));
}

export function isValidInspectionBookingDate(isoDateStr: string, now = new Date()): boolean {
  if (!isoDateStr) return false;
  const day = dayOfWeek(isoDateStr);
  if (day === SATURDAY || day === SUNDAY) return false;
  return isoDateStr >= earliestBookableInspectionDate(now);
}

// The date to put in the field: what was asked for if it is allowed, and
// the earliest that is otherwise.
export function suggestedInspectionBookingDate(isoDateStr: string, now = new Date()): string {
  const earliest = earliestBookableInspectionDate(now);
  if (!isoDateStr) return earliest;
  return pushOffWeekend(isoDateStr < earliest ? earliest : isoDateStr);
}

// The rule in one sentence, for the person choosing a date.
export const BOOKING_RULE_NOTE =
  "Ask before 1pm and the earliest is tomorrow; after 1pm it is the day after. Anything asked on a Friday or over the weekend is booked for the Tuesday.";

// What the firm was engaged to do. The first two produce a certificate of
// our own and then carry the job through as Principal Certifier; the
// third is for a client who already holds a CDC or CC issued by someone
// else and needs us only for the PC appointment and the Occupation
// Certificate.
export type Pathway = "CDC" | "CC" | "PC_OC";

// The two that issue a certificate. Anything asking "does this job
// produce an approval of ours?" asks this rather than testing for PC_OC,
// so a fourth service type later only has to be added in one place.
export function issuesCertificate(pathway: Pathway): pathway is "CDC" | "CC" {
  return pathway === "CDC" || pathway === "CC";
}

// Short label for pills, tabs and lists.
export function pathwayLabel(pathway: Pathway) {
  return pathway === "PC_OC" ? "PC/OC" : pathway;
}

// The full service, as it reads on a quote or at the top of a job.
export function pathwayServiceLabel(pathway: Pathway) {
  return pathway === "PC_OC" ? "PC appointment / OC" : `${pathway} / PC appointment / OC`;
}

// Spelled out, for a document or a line of prose.
export function pathwayFullLabel(pathway: Pathway) {
  if (pathway === "CDC") return "Complying Development Certificate";
  if (pathway === "CC") return "Construction Certificate";
  return "Principal Certifier appointment and Occupation Certificate";
}

export type PriorApproval = { type?: "CDC" | "CC"; number?: string; date?: string; issuedBy?: string };

// The approval the building work is being carried out under, and what to
// call it. On a CDC or CC job that is this firm's own certificate; on a
// PC/OC job it is the certificate another certifier already issued, which
// is what the stamp, the inspection reports and the Occupation
// Certificate must all name — printing our own reference there would
// claim an approval this firm never issued.
export function governingApproval(pathway: Pathway, prior: PriorApproval | undefined, ownRef: string) {
  if (pathway === "PC_OC") {
    return { label: prior?.type || "Approval", ref: (prior?.number || "").trim() || "—" };
  }
  return { label: pathway, ref: ownRef };
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

export function pathwayCertRef(pathway: Pathway, projectNumberOrId: string, version: number) {
  // A PC/OC job issues no certificate of its own, but still needs a
  // reference of its own for the footer, its file names and its
  // inspection reports — "PC-26031/01" rather than a CDC or CC number
  // that would wrongly imply this firm issued the approval.
  const prefix = pathway === "PC_OC" ? "PC" : pathway;
  return `${prefix}-${withoutPathwayPrefix(prefix, projectNumberOrId)}/${String(version || 1).padStart(2, "0")}`;
}

// A certifier can override the generated reference per version / per OC
// record (see migration 0012). Everything that displays or prints a
// reference goes through these so a custom one is honoured consistently —
// on the cards, the certificates, the letters and the inspection reports —
// rather than only in the one place it was typed. Blank or whitespace-only
// falls back to the generated reference.
export function resolvePathwayCertRef(customRef: string | null | undefined, pathway: Pathway, projectNumberOrId: string, version: number) {
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


// NSW ePlanning issues a different reference series depending on what was
// lodged. A complying development certificate is applied for as a
// development application and takes the CDC series; a construction
// certificate or an occupation certificate is lodged as a certificate
// application and takes the CFT series. Getting the series wrong makes a
// certificate impossible to trace back to its Portal application, so the
// prefix is decided here rather than left to whoever is typing.
export type PortalRefKind = "CDC" | "CC" | "OC";

// Which Portal series a job's own reference belongs to. A PC/OC job
// lodges an occupation certificate application, so it takes the CFT
// series the OC and CC share.
export function portalRefKindFor(pathway: Pathway): PortalRefKind {
  return pathway === "PC_OC" ? "OC" : pathway;
}

export function portalRefPrefix(kind: PortalRefKind) {
  return kind === "CDC" ? "CDC" : "CFT";
}

export function portalRefPlaceholder(kind: PortalRefKind) {
  return kind === "CDC" ? "e.g. CDC-331766" : "e.g. CFT-123456";
}

// A certifier reading a number off the Portal types the digits; the
// series in front of them never varies, so it is filled in for them.
// Anything that isn't a bare run of digits is left exactly as typed —
// a reference that already carries its prefix, or one in a shape this
// doesn't know about, is the certifier's to decide, not ours to rewrite.
export function normalizePortalRef(value: string, kind: PortalRefKind) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return /^\d+$/.test(trimmed) ? `${portalRefPrefix(kind)}-${trimmed}` : trimmed;
}

// The building classifications are stored with their plain-English gloss
// — "Class 1a — Single dwelling" — because that is what makes the tick
// boxes readable when a job is being set up. A certificate names the
// classification and nothing else: a certifier writes "Class 1a, 10a",
// and the description of what a Class 1a building is belongs to the NCC,
// not to a certificate. Documents print this; the forms keep the full
// labels, so a job recorded before this still shows the right ticks.
export function formatClassifications(classifications: string[] | undefined | null) {
  const codes = (classifications || [])
    .map((c) => String(c).split("—")[0].trim())
    .filter((c) => c.length > 0);
  if (codes.length === 0) return "";
  // "Class 1a, 10a" rather than "Class 1a, Class 10a", but only when
  // every entry is one of the standard classes. Anything else — a
  // classification typed by hand in a shape this doesn't know — is left
  // exactly as it was written rather than half-rewritten.
  if (codes.every((c) => c.startsWith("Class "))) {
    return `Class ${codes.map((c) => c.slice("Class ".length)).join(", ")}`;
  }
  return codes.join(", ");
}
