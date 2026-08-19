import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { unresolvedCount, daysUntil, calcCdcLapseDate } from "@/lib/business";
import Link from "next/link";
import { DashboardSearch } from "@/components/certifier/DashboardSearch";
import { TaskBoard } from "@/components/certifier/TaskBoard";
import type { TaskList, ManualTask } from "@/types/db";

type Task = { priority: "High" | "Medium" | "Low"; text: string; jobId: string | null; href: string };

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

  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, address, description, pathway, details, " +
        "checklists(kind, checklist_items(status, amendments(resolved))), " +
        "inspections(id, title, date, outcome, booked_by_client, confirmed)"
    )
    .eq("firm_id", profile.firm_id)
    .eq("status", "active")
    .returns<DashboardJob[]>();

  const { data: certifiers } = await supabase
    .from("certifiers")
    .select("id, name, pi_insurance_expiry, registration_expiry")
    .eq("firm_id", profile.firm_id);

  const [{ data: taskLists }, { data: manualTasks }] = await Promise.all([
    supabase.from("task_lists").select("*").eq("firm_id", profile.firm_id).order("sort_order"),
    supabase.from("manual_tasks").select("*, task_lists!inner(firm_id)").eq("task_lists.firm_id", profile.firm_id).order("sort_order"),
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

  for (const p of jobs || []) {
    const href = `/jobs/${p.id}`;
    const allItems = (p.checklists || []).flatMap((cl) => cl.checklist_items || []);
    const awaitingReview = allItems.filter((i) => i.status === "submitted" && unresolvedCount(i as never) === 0).length;
    if (awaitingReview > 0) {
      tasks.push({ priority: "Medium", text: `${awaitingReview} document${awaitingReview === 1 ? "" : "s"} submitted — awaiting your review — ${p.address}`, jobId: p.id, href });
    }
    const unconfirmed = (p.inspections || []).filter((i) => i.booked_by_client && !i.confirmed);
    for (const i of unconfirmed) {
      tasks.push({ priority: "High", text: `Inspection booked by client — ${i.title} on ${i.date} — needs confirmation — ${p.address}`, jobId: p.id, href: `${href}?tab=inspections` });
    }
    if (p.pathway === "CDC") {
      const nocChecklist = (p.checklists || []).find((c) => c.kind === "noc");
      const outcomes = (p.inspections || []).map((i) => i.outcome);
      const lapse = calcCdcLapseDate("CDC", p.details?.certificateDetails?.determinationDate, (nocChecklist?.checklist_items || []) as never, outcomes);
      const d = daysUntil(lapse);
      if (d !== null && d <= 90) {
        tasks.push({ priority: "High", text: d < 0 ? `CDC lapsed ${lapse} — ${p.address}` : `CDC lapses in ${d} day${d === 1 ? "" : "s"} (${lapse}) — ${p.address}`, jobId: p.id, href });
      }
    }
  }

  const order = { High: 0, Medium: 1, Low: 2 };
  tasks.sort((a, b) => order[a.priority] - order[b.priority]);

  return (
    <div className="px-2 py-10">
      <div className="flex flex-col items-center">
        <div className="w-full max-w-lg">
          <DashboardSearch jobs={(jobs || []).map((p) => ({ id: p.id, address: p.address, description: p.description || "", pathway: p.pathway }))} />
        </div>

        {tasks.length > 0 && (
          <div className="w-full max-w-lg mt-10">
            <div className="text-[11px] tracking-[0.15em] uppercase text-slate-500 mb-2 px-1">Needs your attention</div>
            <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
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
        )}

        {tasks.length === 0 && <div className="mt-10 text-sm text-slate-400">Nothing needs your attention right now.</div>}
      </div>

      <div className="mt-12">
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
