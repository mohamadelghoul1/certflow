// The neighbour notification period, counted the way the practice
// counts it.
//
// The notice runs for 15 days, with the day it starts as day one. A
// notice that goes out on a Friday sits in letterboxes over the
// weekend, so its first day is not counted until the following Tuesday
// — the period runs from there.

// Parsed at midnight local time, the same way every other date column
// in the app is read (see formatISODate), so a date typed as the 5th
// never counts as the 4th in another timezone.
function parseDay(iso: string): Date | null {
  const day = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return isNaN(day.getTime()) ? null : day;
}

function toIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const FRIDAY = 5;

// The day the 15 begins: the start date itself, unless the notice went
// out on a Friday — then the following Tuesday.
export function notificationFirstDay(startIso: string): string | null {
  const day = parseDay(startIso);
  if (!day) return null;
  if (day.getDay() === FRIDAY) day.setDate(day.getDate() + 4);
  return toIso(day);
}

// The last of the 15 days: day one plus fourteen.
export function notificationEndDate(startIso: string): string | null {
  const first = notificationFirstDay(startIso);
  if (!first) return null;
  const day = parseDay(first)!;
  day.setDate(day.getDate() + 14);
  return toIso(day);
}
