// The inspection week, as a diary rather than a list.
//
// A list answers "what is booked". A week answers the questions that
// actually change what a certifier does: is Thursday already full, is
// anything sitting in the past with no outcome recorded, and are two of
// Tuesday's jobs in the same suburb — because those are one trip, and
// nobody spots that reading down a list sorted by date.

export type DiaryInspection = {
  id: string;
  job_id: string;
  title: string;
  date: string | null;
  outcome: string;
  confirmed: boolean;
  booked_by_client: boolean;
  address: string;
  certifier: string | null;
};

export type DiaryDay = {
  date: string;
  // Monday first: a working week reads Mon–Fri, and a diary that starts
  // on Sunday splits it in two.
  weekday: string;
  isToday: boolean;
  isWeekend: boolean;
  inspections: DiaryInspection[];
  // Suburbs with more than one visit that day — the trips worth
  // combining.
  runs: { suburb: string; count: number }[];
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// 0 = Monday. Dates are handled as plain calendar days throughout, never
// as instants, so a certifier in Sydney and a server in another timezone
// agree on which day Thursday is.
export function weekdayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function startOfWeek(isoDate: string): string {
  return addDays(isoDate, -weekdayIndex(isoDate));
}

// The suburb out of a site address, for spotting two jobs in one place.
//
// Addresses are typed by hand and imported from another system, so the
// only thing that can be relied on is that the suburb comes last — after
// the final comma, before the state and postcode that may or may not be
// there.
export function suburbOf(address: string): string {
  const tail = (address || "").split(",").pop() || "";
  return tail
    .replace(/\b(NSW|ACT|VIC|QLD|SA|WA|TAS|NT)\b/gi, " ")
    .replace(/\b\d{4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function runsFor(inspections: DiaryInspection[]) {
  const counts = new Map<string, number>();
  for (const inspection of inspections) {
    const suburb = suburbOf(inspection.address);
    if (!suburb) continue;
    counts.set(suburb, (counts.get(suburb) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([suburb, count]) => ({ suburb, count }))
    .sort((a, b) => b.count - a.count || a.suburb.localeCompare(b.suburb));
}

export function diaryWeek(inspections: DiaryInspection[], weekStart: string, today: string): DiaryDay[] {
  const byDate = new Map<string, DiaryInspection[]>();
  for (const inspection of inspections) {
    if (!inspection.date) continue;
    (byDate.get(inspection.date) || byDate.set(inspection.date, []).get(inspection.date)!).push(inspection);
  }

  return Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(weekStart, offset);
    const dayInspections = (byDate.get(date) || []).sort(
      (a, b) => suburbOf(a.address).localeCompare(suburbOf(b.address)) || a.address.localeCompare(b.address) || a.title.localeCompare(b.title),
    );
    return {
      date,
      weekday: WEEKDAYS[offset],
      isToday: date === today,
      isWeekend: offset >= 5,
      inspections: dayInspections,
      runs: runsFor(dayInspections),
    };
  });
}

// Anything whose date has passed with no outcome recorded. Shown above
// the week wherever the diary is pointed, because an inspection that
// never got an outcome is the one thing on this screen that is wrong
// rather than merely upcoming.
export function overdueInspections(inspections: DiaryInspection[], today: string): DiaryInspection[] {
  return inspections
    .filter((i) => i.date && i.date < today && i.outcome === "pending")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}
