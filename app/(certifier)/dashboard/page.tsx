import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { unresolvedCount, daysUntil, calcCdcLapseDate, formatISODate } from "@/lib/business";
import { getAuditEvents } from "@/lib/reporting";
import Link from "next/link";
import { DashboardSearch } from "@/components/certifier/DashboardSearch";
import { TaskBoard } from "@/components/certifier/TaskBoard";
import { AlertTriangle, Building2, CalendarCheck, ClipboardCheck, Activity, CalendarClock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TaskList, ManualTask } from "@/types/db";

type Task = { priority: "High" | "Medium" | "Low"; text: string; jobId: string | null; href: string };

function StatCard({ icon: Icon, label, value, href, linkLabel }: { icon: LucideIcon; label: string; value: number; href: string; linkLabel: string }) {
  return (
    <Link href={href} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-300 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Icon size={16} className="text-teal-700" />
      </div>
      <div className="text-3xl font-bold text-teal-900 mt-2">{value}</div>
      <div className="text-xs text-teal-700 font-medium mt-1">{linkLabel} →</div>
    </Link>
  );
}

type DashboardJob = {
  id: string;
  address: string;
  description: string | null;
  pathway: "CDC" | "CC";
  details: { certificateDetails?: { determinationDate?: string } };
  checklists: { kind: string; checklist_items: { status: string; amendments: { resolved: boolean }[] }[] }[];
  inspections: { id: string; title: string; date: string | null; outcome: string; booked_by_client: boolean; confirmed: boolean }[];
};

export default async function DashboardPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const [{ data: jobs }, { data: certifiers }, { data: taskLists }, { data: manualTasks }, auditEvents] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, address, description, pathway, details, " +
          "checklists(kind, checklist_items(status, amendments(resolved))), " +
          "inspections(id, title, date, outcome, booked_by_client, confirmed)"
      )
      .eq("firm_id", profile.firm_id)
      .eq("status", "active")
      .returns<DashboardJob[]>(),
    supabase.from("certifiers").select("id, name, pi_insurance_expiry, registration_expiry").eq("firm_id", profile.firm_id),
    supabase.from("task_lists").select("*").eq("firm_id", profile.firm_id).order("sort_order"),
    supabase.from("manual_tasks").select("*, task_lists!inner(firm_id)").eq("task_lists.firm_id", profile.firm_id).order("sort_order"),
    getAuditEvents(supabase, profile.firm_id),
  ]);
  const tasksByList = new Map<string, ManualTask[]>();
  for (const t of (manualTasks || []) as ManualTask[]) {
    const existing = tasksByList.get(t.list_id);
    if (existing) existing.push(t);
    else tasksByList.set(t.list_id, [t]);
  }
  const listsWithTasks = ((taskLists || []) as TaskList[]).map((l) => ({ ...l, tasks: tasksByList.get(l.id) || [] }));

  // "Needs your attention" is intentionally narrow: client submissions,
  // client bookings, PI/registration expiry, and CDC lapse dates. Ready-to-
  // issue nudges, portal deadlines, and open-amendment counts are
  // deliberately left out — those are tracked elsewhere, not here.
  const tasks: Task[] = [];

  for (const c of certifiers || []) {
    const piDays = daysUntil(c.pi_insurance_expiry);
    if (piDays !== null && piDays <= 30) {
      tasks.push({
        priority: "High",
        text: piDays < 0 ? `${c.name}'s PI insurance expired` : `${c.name}'s PI insurance expires in ${piDays} day${piDays === 1 ? "" : "s"}`,
        jobId: null,
        href: "/settings",
      });
    }
    const regDays = daysUntil(c.registration_expiry);
    if (regDays !== null && regDays <= 30) {
      tasks.push({
        priority: "High",
        text: regDays < 0 ? `${c.name}'s registration/CPD renewal is overdue` : `${c.name}'s registration/CPD renewal due in ${regDays} day${regDays === 1 ? "" : "s"}`,
        jobId: null,
        href: "/settings",
      });
    }
  }

  // Modification checklists live under the pathway tab, not their own —
  // route both there so the click lands on the right tab straight away.
  const tabForKind: Record<string, string> = { pathway: "pathway", modification: "pathway", noc: "noc", oc: "oc" };

  let approvalsDueCount = 0;
  const upcomingInspections: { jobId: string; address: string; title: string; date: string; daysAway: number }[] = [];

  for (const p of jobs || []) {
    const href = `/jobs/${p.id}`;
    for (const cl of p.checklists || []) {
      const awaitingReview = (cl.checklist_items || []).filter((i) => i.status === "submitted" && unresolvedCount(i as never) === 0).length;
      approvalsDueCount += awaitingReview;
      if (awaitingReview > 0) {
        const tab = tabForKind[cl.kind] || "details";
        tasks.push({
          priority: "Medium",
          text: `${awaitingReview} document${awaitingReview === 1 ? "" : "s"} submitted — awaiting your review — ${p.address}`,
          jobId: p.id,
          href: `${href}?tab=${tab}`,
        });
      }
    }
    const unconfirmed = (p.inspections || []).filter((i) => i.booked_by_client && !i.confirmed);
    for (const i of unconfirmed) {
      tasks.push({ priority: "High", text: `Inspection booked by client — ${i.title} on ${i.date} — needs confirmation — ${p.address}`, jobId: p.id, href: `${href}?tab=inspections` });
    }
    for (const i of p.inspections || []) {
      if (!i.date) continue;
      const d = daysUntil(i.date);
      if (d !== null && d >= 0) upcomingInspections.push({ jobId: p.id, address: p.address, title: i.title, date: i.date, daysAway: d });
    }
    if (p.pathway === "CDC") {
      const nocChecklist = (p.checklists || []).find((c) => c.kind === "noc");
      const outcomes = (p.inspections || []).map((i) => i.outcome);
      const lapse = calcCdcLapseDate("CDC", p.details?.certificateDetails?.determinationDate, (nocChecklist?.checklist_items || []) as never, outcomes);
      const d = daysUntil(lapse);
      if (d !== null && d <= 90) {
        tasks.push({
          priority: "High",
          text: d < 0 ? `CDC lapsed ${lapse} — ${p.address}` : `CDC lapses in ${d} day${d === 1 ? "" : "s"} (${lapse}) — ${p.address}`,
          jobId: p.id,
          href: `${href}?tab=pathway`,
        });
      }
    }
  }

  const order = { High: 0, Medium: 1, Low: 2 };
  tasks.sort((a, b) => order[a.priority] - order[b.priority]);

  const inspectionsThisWeekCount = upcomingInspections.filter((u) => u.daysAway <= 7).length;
  upcomingInspections.sort((a, b) => a.daysAway - b.daysAway);
  const nextInspections = upcomingInspections.slice(0, 5);

  const recentActivity = [...auditEvents].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 6);

  return (
    <div className="px-2 sm:px-4 py-10 max-w-5xl mx-auto">
      <div className="max-w-lg mx-auto">
        <DashboardSearch jobs={(jobs || []).map((p) => ({ id: p.id, address: p.address, description: p.description || "", pathway: p.pathway }))} />
      </div>

      <div className="mt-10 grid sm:grid-cols-3 gap-4">
        <StatCard icon={Building2} label="Active Projects" value={(jobs || []).length} href="/jobs" linkLabel="View all projects" />
        <StatCard icon={CalendarCheck} label="Inspections This Week" value={inspectionsThisWeekCount} href="/jobs" linkLabel="View projects" />
        <StatCard icon={ClipboardCheck} label="Approvals Due" value={approvalsDueCount} href="/jobs" linkLabel="Review submissions" />
      </div>

      {tasks.length > 0 ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-100">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">Needs your attention</span>
          </div>
          <div className="bg-white">
            {tasks.slice(0, 8).map((t, i) => {
              const dot = t.priority === "High" ? "bg-red-500" : t.priority === "Medium" ? "bg-amber-500" : "bg-slate-400";
              return (
                <Link key={i} href={t.href} className="block px-4 py-3 border-t border-slate-100 first:border-t-0 hover:bg-slate-50 flex items-start gap-3">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                  <div className="text-sm text-slate-700">{t.text}</div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-sm text-emerald-700">Nothing needs your attention right now.</div>
      )}

      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
            <Activity size={14} className="text-teal-700" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Recent Activity</span>
          </div>
          {recentActivity.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No activity yet.</div>
          ) : (
            recentActivity.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-3 px-4 py-3 border-t border-slate-100 first:border-t-0">
                <div className="min-w-0">
                  <div className="text-sm text-slate-700 truncate">{e.action}</div>
                  <div className="text-xs text-slate-400 truncate">{e.address}</div>
                </div>
                <div className="text-xs text-slate-400 shrink-0 whitespace-nowrap">{formatISODate(e.date)}</div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
            <CalendarClock size={14} className="text-teal-700" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Upcoming Inspections</span>
          </div>
          {nextInspections.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Nothing booked.</div>
          ) : (
            nextInspections.map((u, i) => (
              <Link key={i} href={`/jobs/${u.jobId}?tab=inspections`} className="flex items-start justify-between gap-3 px-4 py-3 border-t border-slate-100 first:border-t-0 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="text-sm text-slate-700 truncate">{u.title}</div>
                  <div className="text-xs text-slate-400 truncate">{u.address}</div>
                </div>
                <div className="text-xs font-medium text-teal-700 shrink-0 whitespace-nowrap">{formatISODate(u.date)}</div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="mt-10">
        <div className="text-[11px] tracking-[0.15em] uppercase text-slate-500 mb-2 px-1">Tasks</div>
        {listsWithTasks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 px-1">
            {listsWithTasks.map((l) => {
              const open = l.tasks.filter((t) => !t.completed).length;
              return (
                <span
                  key={l.id}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
                    open > 0 ? "bg-white border-teal-200 text-teal-800" : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}
                >
                  {open} {l.title}
                </span>
              );
            })}
          </div>
        )}
        <TaskBoard lists={listsWithTasks} />
      </div>
    </div>
  );
}
