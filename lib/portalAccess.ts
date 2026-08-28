import { formatISODate } from "@/lib/business";

// How long a finished project's certificates stay downloadable from the
// client portal.
//
// The portal is where a client fetches their approval and their
// Occupation Certificate while the job is live. Once the whole OC has
// been issued the job is finished, and the portal stops being a
// document library: the client has had the documents, and leaving every
// completed job's certificates permanently downloadable by anyone who
// still has portal access is a liability rather than a service. Twenty-
// one days is the grace period to save a copy.
//
// This closes the *portal*, nothing else. The certifier keeps every
// document, the audit trail is untouched, and a client who missed the
// window asks for a copy — which is a conversation, not a download.
export const CERTIFICATE_ACCESS_DAYS = 21;

const DAY_MS = 86_400_000;

type OcLike = { type: "partial" | "whole"; generated_date: string | null; created_at?: string; sent_to_client?: boolean };

// The day the whole OC was issued, or null while the job is still
// running. A partial OC doesn't finish a job, so it doesn't start the
// clock.
export function wholeOcIssuedAt(records: OcLike[]): string | null {
  const whole = records.filter((r) => r.type === "whole").map((r) => r.generated_date || r.created_at || null).filter((d): d is string => !!d);
  if (whole.length === 0) return null;
  // The earliest, so re-issuing a corrected copy can't quietly extend
  // the window.
  return whole.sort()[0];
}

export function accessClosesAt(records: OcLike[]): Date | null {
  const issued = wholeOcIssuedAt(records);
  if (!issued) return null;
  return new Date(new Date(issued).getTime() + CERTIFICATE_ACCESS_DAYS * DAY_MS);
}

// Whether the portal will still hand over this job's certificates.
export function certificatesDownloadable(records: OcLike[], now: Date = new Date()): boolean {
  const closes = accessClosesAt(records);
  return !closes || now.getTime() < closes.getTime();
}

// What the client is told in place of the download links.
export function accessClosedNotice(records: OcLike[]): string {
  const closes = accessClosesAt(records);
  const on = closes ? formatISODate(closes.toISOString().slice(0, 10)) : "";
  return `This project is complete and its certificates were available to download here until ${on}. Please contact us if you need a further copy.`;
}
