import { formatISODate } from "@/lib/business";

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
  const opening = rebooking
    ? `<p>Your <strong>${title}</strong> inspection has been moved to <strong>${when}</strong>.</p>`
    : `<p>We have booked your <strong>${title}</strong> inspection for <strong>${when}</strong>.</p>`;

  return {
    subject: `Inspection ${rebooking ? "rescheduled" : "booked"} — ${title}`,
    html: `${opening}
     <p>Please make sure the site is ready and accessible on the day. If that date does not suit, call us and we will find another.</p>`,
  };
}
