import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, MapPin, Route } from "lucide-react";
import { todayInNsw, formatISODate } from "@/lib/business";
import { diaryWeek, overdueInspections, startOfWeek, addDays, type DiaryInspection } from "@/lib/calendar/week";
import { CalendarSubscribe } from "@/components/certifier/CalendarSubscribe";
import { BookInspectionButton } from "@/components/certifier/BookInspectionButton";

// The inspection week.
//
// The list on a job answers "what does this project still need". This
// answers the question that decides how a week is actually spent: what
// is Thursday like, what did I miss, and which of these are the same
// trip.

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const today = todayInNsw();

  const { week } = await searchParams;
  const weekStart = startOfWeek(/^\d{4}-\d{2}-\d{2}$/.test(week || "") ? week! : today);

  // Row security keeps this to the firm. Asked for wide rather than
  // filtered to the week, because the overdue banner has to see behind
  // the week being looked at.
  const { data } = await supabase
    .from("inspections")
    .select("id, job_id, title, date, outcome, confirmed, booked_by_client, certifiers(name), jobs!inner(address, deleted_at)")
    .not("date", "is", null)
    .order("date");

  // Everything still waiting for a day, across every live job — so a week
  // can be filled in from here rather than by opening each job in turn to
  // hunt for the inspection that needs booking. Row security keeps it to
  // the firm, like the query above.
  const { data: unbookedRows } = await supabase
    .from("inspections")
    .select("id, job_id, title, jobs!inner(address, deleted_at)")
    .is("date", null)
    .eq("outcome", "pending")
    .order("created_at");
  const unbooked = ((unbookedRows || []) as unknown as { id: string; job_id: string; title: string; jobs: { address: string; deleted_at: string | null } | null }[])
    .filter((row) => row.jobs && !row.jobs.deleted_at)
    .map((row) => ({ id: row.id, jobId: row.job_id, title: row.title, address: row.jobs!.address || "" }));

  const inspections: DiaryInspection[] = ((data || []) as unknown as (DiaryInspection & {
    jobs: { address: string; deleted_at: string | null } | null;
    certifiers: { name: string } | null;
  })[])
    .filter((row) => row.jobs && !row.jobs.deleted_at)
    .map((row) => ({ ...row, address: row.jobs!.address || "", certifier: row.certifiers?.name || null }));

  const days = diaryWeek(inspections, weekStart, today);
  const overdue = overdueInspections(inspections, today);
  const booked = days.reduce((n, d) => n + d.inspections.length, 0);

  // A week with nothing on Saturday or Sunday shows five columns rather
  // than two empty ones — which is most weeks.
  const weekendUsed = days.slice(5).some((d) => d.inspections.length > 0);
  const shown = weekendUsed ? days : days.slice(0, 5);

  // In its own table, not on certifiers: a client with a portal login
  // can read every column of their firm's certifiers row, and a token
  // there would hand them the firm's whole diary. See migration 0052.
  const { data: feed } = await supabase
    .from("certifier_calendar_feeds")
    .select("token")
    .eq("certifier_id", profile.certifier_id || "")
    .maybeSingle();
  const token = (feed as { token?: string } | null)?.token || null;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-[28px] font-bold text-heading tracking-tight">Calendar</h1>
          <p className="text-sm text-muted mt-1">
            {booked === 0 ? "Nothing booked this week." : `${booked} inspection${booked === 1 ? "" : "s"} booked this week.`}
          </p>
        </div>
        <CalendarSubscribe token={token} certifierId={profile.certifier_id || null} />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <WeekButton href={`/calendar?week=${addDays(weekStart, -7)}`} label="Previous week">
          <ChevronLeft size={16} />
        </WeekButton>
        <Link
          href="/calendar"
          className="px-3 py-1.5 rounded-md border border-line bg-white text-xs font-semibold text-secondary hover:bg-hover"
        >
          This week
        </Link>
        <WeekButton href={`/calendar?week=${addDays(weekStart, 7)}`} label="Next week">
          <ChevronRight size={16} />
        </WeekButton>
        <div className="text-sm font-semibold text-heading ml-1">
          {formatISODate(weekStart)} – {formatISODate(addDays(weekStart, 6))}
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="border border-error/40 bg-error-bg rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-error mb-2">
            <AlertTriangle size={15} /> {overdue.length} inspection{overdue.length === 1 ? "" : "s"} past their date with no outcome recorded
          </div>
          <div className="space-y-1">
            {overdue.slice(0, 6).map((i) => (
              <Link key={i.id} href={`/jobs/${i.job_id}?tab=inspections`} className="block text-xs text-muted hover:text-primary">
                <span className="font-medium text-heading">{formatISODate(i.date!)}</span> · {i.title} · {i.address}
              </Link>
            ))}
            {overdue.length > 6 && <div className="text-xs text-placeholder">and {overdue.length - 6} more.</div>}
          </div>
        </div>
      )}

      {unbooked.length > 0 && (
        <details className="border border-line rounded-lg bg-white mb-4">
          <summary className="flex items-center gap-2 p-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-sm font-semibold text-heading">
            <CalendarPlus size={15} className="text-secondary" />
            {unbooked.length} inspection{unbooked.length === 1 ? "" : "s"} with no day booked
            <span className="ml-auto text-xs font-normal text-muted">Book from here</span>
          </summary>
          <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">
            {unbooked.map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <Link href={`/jobs/${i.jobId}?tab=inspections`} className="text-sm font-medium text-heading hover:text-primary">
                    {i.title}
                  </Link>
                  <div className="text-xs text-muted">{i.address}</div>
                </div>
                <BookInspectionButton inspectionId={i.id} jobId={i.jobId} bookedDate={null} confirmed={false} />
              </div>
            ))}
          </div>
        </details>
      )}

      {/* One column per day on a wide screen, one row per day on a
          phone — a seven-column grid on a handset is unreadable. */}
      <div className={`grid gap-3 grid-cols-1 ${weekendUsed ? "lg:grid-cols-7" : "lg:grid-cols-5"}`}>
        {shown.map((day) => (
          <div
            key={day.date}
            // An empty day is a column on a wide screen and nothing at
            // all on a phone: seven empty boxes to scroll past is not a
            // diary, and the week only reads as a week when it is a row.
            className={`rounded-lg border p-3 lg:min-h-[7rem] ${day.inspections.length === 0 ? "hidden lg:block" : ""} ${
              day.isToday ? "border-secondary bg-info-bg" : day.isWeekend ? "border-line bg-surface" : "border-line bg-white"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div className={`text-xs font-bold uppercase tracking-wider ${day.isToday ? "text-secondary" : "text-placeholder"}`}>
                <span className="lg:hidden">{day.weekday}</span>
                <span className="hidden lg:inline">{day.weekday.slice(0, 3)}</span>
                {day.isToday && <span className="ml-1.5 normal-case font-semibold">· Today</span>}
              </div>
              <div className={`text-sm font-semibold ${day.isToday ? "text-secondary" : "text-muted"}`}>{Number(day.date.slice(8))}</div>
            </div>

            {day.runs.map((run) => (
              <div key={run.suburb} className="flex items-center gap-1.5 text-[11px] font-semibold text-accent bg-success-bg rounded px-1.5 py-1 mb-2">
                <Route size={11} className="shrink-0" /> {run.count} in {run.suburb}
              </div>
            ))}

            <div className="space-y-2">
              {day.inspections.map((inspection) => (
                <Link
                  key={inspection.id}
                  href={`/jobs/${inspection.job_id}?tab=inspections`}
                  className="block rounded-md border border-line bg-white p-2 hover:border-secondary hover:shadow-sm"
                >
                  <div className="text-xs font-semibold text-heading leading-snug">{inspection.title}</div>
                  <div className="flex items-start gap-1 text-[11px] text-muted mt-0.5">
                    <MapPin size={10} className="shrink-0 mt-0.5 text-placeholder" />
                    <span className="min-w-0">{inspection.address}</span>
                  </div>
                  {inspection.booked_by_client && !inspection.confirmed && (
                    <div className="text-[11px] text-warning-text mt-1">Not yet confirmed</div>
                  )}
                </Link>
              ))}
              {day.inspections.length === 0 && <div className="hidden lg:block text-[11px] text-placeholder">—</div>}
            </div>
          </div>
        ))}
      </div>

      {booked === 0 && overdue.length === 0 && (
        <div className="bg-white border border-line rounded-xl p-8 text-center mt-4">
          <CalendarDays size={26} className="mx-auto text-placeholder mb-2" />
          <div className="text-sm text-muted">Inspections appear here once they have a date — booked from the project, or by the client from their portal.</div>
        </div>
      )}
    </div>
  );
}

function WeekButton({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex items-center justify-center w-8 h-8 rounded-md border border-line bg-white text-muted hover:bg-hover hover:text-primary"
    >
      {children}
    </Link>
  );
}
