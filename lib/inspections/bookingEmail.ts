import { formatISODate } from "@/lib/business";
import { escapeHtml } from "@/lib/html";

// What the client is told when a certifier books, or moves, an
// inspection themselves.
//
// Its own module rather than inline in the action so the wording that
// reaches a builder can be held to by a test: an email saying "booked"
// about a visit that was moved, or naming the wrong day, is the kind of
// mistake that has someone waiting on site on the wrong morning.

export type BookingEmail = { subject: string; html: string };

export function inspectionBookingEmail(title: string, date: string, rebooking: boolean): BookingEmail {
  const when = formatISODate(date);
  // The inspection's name is typed by a certifier; escaped anyway, so no
  // email body can be reshaped by what someone put in a field.
  const named = escapeHtml(title);
  const opening = rebooking
    ? `<p>Your <strong>${named}</strong> inspection has been moved to <strong>${when}</strong>.</p>`
    : `<p>We have booked your <strong>${named}</strong> inspection for <strong>${when}</strong>.</p>`;

  return {
    subject: `Inspection ${rebooking ? "rescheduled" : "booked"} — ${title}`,
    html: `${opening}
     <p>Please make sure the site is ready and accessible on the day. If that date does not suit, call us and we will find another.</p>`,
  };
}
