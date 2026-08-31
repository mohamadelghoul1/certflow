import { formatISODate } from "@/lib/business";
import { escapeHtml } from "@/lib/html";

// The email a certifier gets when a client asks for an inspection date.
//
// It has to answer, without opening anything, the question that decides
// the reply: can that day be done? So it carries the site address — a
// bare inspection name says nothing about where the van has to be — and
// what the firm already has booked for the same day, which is the
// difference between accepting a date and discovering the clash on the
// morning.

export type SameDayInspection = { title: string; address: string; certifier?: string | null };

export function inspectionRequestEmail({
  title,
  date,
  address,
  sameDay,
}: {
  title: string;
  date: string | null;
  address: string | null;
  // Everything else the firm has on that day, this request excluded.
  sameDay: SameDayInspection[];
}): { subject: string; html: string } {
  const when = formatISODate(date);
  const site = (address || "").trim();

  // Everything interpolated here comes from the database, but it began
  // as something a person typed — an address, an inspection someone
  // named. Escaped so a stray angle bracket cannot reshape the email.
  const heading = `<p>Your client has asked for the <strong>${escapeHtml(title || "an")}</strong> inspection on <strong>${when}</strong>.</p>`;
  const where = site ? `<p><strong>Site:</strong> ${escapeHtml(site)}</p>` : "";

  const alreadyBooked =
    sameDay.length === 0
      ? `<p>Nothing else is booked for that day.</p>`
      : `<p><strong>Already booked for ${when}:</strong></p>
     <ul>${sameDay
       .map((i) => `<li>${escapeHtml(i.title)} — ${escapeHtml(i.address || "address not recorded")}${i.certifier ? ` (${escapeHtml(i.certifier)})` : ""}</li>`)
       .join("")}</ul>`;

  return {
    subject: `Inspection requested — ${title || "inspection"}${site ? ` — ${site}` : ""}`,
    html: `${heading}${where}${alreadyBooked}<p>Accept the day or offer another in Certlyn. Until you do, your client's portal shows the request as waiting on your office.</p>`,
  };
}
