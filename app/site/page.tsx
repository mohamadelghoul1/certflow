import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronRight, CalendarCheck, MapPin } from "lucide-react";
import { todayInNsw, formatISODate } from "@/lib/business";
import { visitGroups, type VisitInspection } from "@/lib/site/visitList";

// The day's work. Opened in the van, not at a desk — so it answers one
// question and stops: where am I going, and what am I doing when I get
// there.
export default async function SitePage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  // Every inspection on the firm's live projects. Row security keeps it
  // to this firm; the grouping below keeps it to this week.
  const { data } = await supabase
    .from("inspections")
    .select("id, job_id, title, date, outcome, confirmed, booked_by_client, report_signed_at, jobs!inner(address, deleted_at, status)")
    .order("date");

  const inspections: VisitInspection[] = ((data || []) as unknown as (VisitInspection & { jobs: { address: string; deleted_at: string | null; status: string } })[])
    .filter((row) => !row.jobs?.deleted_at)
    .map((row) => ({ ...row, address: row.jobs?.address || "" }));

  const groups = visitGroups(inspections, todayInNsw());
  const total = groups.reduce((n, g) => n + g.inspections.length, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-heading tracking-tight">
        {total === 0 ? "Nothing booked" : `${total} inspection${total === 1 ? "" : "s"}`}
      </h1>
      <p className="text-sm text-muted mt-1 mb-5">
        {total === 0 ? "No inspections are booked for the week ahead." : "Tap one to record what you found and send the report before you leave."}
      </p>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className={`text-xs font-bold uppercase tracking-wider mb-2 ${group.key === "overdue" ? "text-error" : "text-placeholder"}`}>{group.label}</h2>
            <div className="space-y-2">
              {group.inspections.map((inspection) => (
                <Link
                  key={inspection.id}
                  href={`/site/${inspection.id}`}
                  className={`flex items-center gap-3 bg-white border rounded-xl p-4 active:bg-hover ${group.key === "overdue" ? "border-error/40" : "border-line"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-primary leading-snug">{inspection.title}</div>
                    <div className="text-sm text-muted mt-0.5 flex items-start gap-1.5">
                      <MapPin size={14} className="shrink-0 mt-0.5 text-placeholder" />
                      <span className="min-w-0">{inspection.address}</span>
                    </div>
                    <div className="text-xs text-placeholder mt-1 flex items-center gap-1.5">
                      <CalendarCheck size={12} />
                      {formatISODate(inspection.date)}
                      {inspection.booked_by_client && !inspection.confirmed ? " · booked by the client, not yet confirmed" : ""}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-placeholder shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {total === 0 && (
        <div className="bg-white border border-line rounded-xl p-8 text-center">
          <CalendarCheck size={26} className="mx-auto text-placeholder mb-2" />
          <div className="text-sm text-muted">Inspections appear here once they have a date. Book one from the project, or the client books it from their portal.</div>
        </div>
      )}
    </div>
  );
}
