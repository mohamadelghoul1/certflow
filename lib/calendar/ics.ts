// The inspection diary as a calendar feed.
//
// A certifier's week does not live in CertFlow — it lives in whatever
// calendar is already on their phone, beside the school pickup and the
// dentist. So rather than asking them to check two places, this hands
// that calendar a subscription: one URL, added once, and every inspection
// booked from then on appears in it.
//
// The format is RFC 5545, which is old, strict, and unforgiving in ways
// that fail silently — a calendar app that dislikes a line does not
// complain, it just shows an empty diary. The three rules that actually
// bite are all handled here: CRLF endings, escaping inside text values,
// and folding lines longer than 75 octets.

export type CalendarEvent = {
  // Stable for the life of the inspection. A calendar matches events by
  // UID on every refresh, so a changing one turns an edit into a
  // duplicate and a cancellation into a leftover.
  uid: string;
  // The day it happens. These are all-day events: an inspection is
  // booked for a date, and inventing "9am" would put a time in the
  // certifier's diary that nobody agreed to.
  date: string;
  summary: string;
  location: string;
  description: string;
  url?: string;
};

// Escaping inside a TEXT value. Backslash first, or it escapes the
// escapes added after it.
export function escapeText(value: string) {
  return (value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// A line longer than 75 octets is continued on the next one, which
// begins with a single space. Counted in octets rather than characters —
// an address with an accent in it is more bytes than it looks — and
// never split inside a character, which would corrupt it.
export function foldLine(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  // 74 on continuation lines: the leading space is part of the 75.
  while (start < bytes.length) {
    const limit = parts.length === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);
    // Back off a byte at a time until the slice ends on a character
    // boundary — a continuation byte is 10xxxxxx.
    while (end > start && end < bytes.length && (bytes[end] & 0b11000000) === 0b10000000) end -= 1;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return parts.join("\r\n ");
}

function yyyymmdd(isoDate: string) {
  return isoDate.replace(/-/g, "");
}

// An all-day event's end date is exclusive: a one-day inspection on the
// 26th ends on the 27th. Getting this wrong shows a two-day block, or
// nothing at all.
function dayAfter(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function buildIcs(events: CalendarEvent[], calendarName: string, now = new Date()): string {
  const stamp = `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CertFlow//Inspections//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    // How often a subscribed calendar should come back. Without it some
    // apps refresh daily, which is too slow for an inspection booked
    // this morning for tomorrow.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${yyyymmdd(event.date)}`,
      `DTEND;VALUE=DATE:${yyyymmdd(dayAfter(event.date))}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `LOCATION:${escapeText(event.location)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
    );
    // A URL is not a TEXT value and is not escaped — a calendar that
    // followed an escaped one would open a broken link.
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
