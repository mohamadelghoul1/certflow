import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { unresolvedCount } from "@/lib/business";
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
  checklists: { checklist_items: { status: string; amendments: { resolved: boolean }[] }[] }[];
  inspections: { id: string; title: string; date: string | null; booked_by_client: boolean; confirmed: boolean }[];
};

export default async function DashboardPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, address, description, pathway, checklists(checklist_items(status, amendments(resolved))), inspections(id, title, date, booked_by_client, confirmed)")
    .eq("firm_id", profile.firm_id)
    .eq("status", "active")
    .returns<DashboardJob[]>();

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

  // Only two things belong on "Needs your attention": a client submitted a
  // document for review, or a client booked an inspection. Everything else
  // (lapse dates, portal deadlines, PI expiry, etc.) is deliberately left
  // out — those are tracked elsewhere, not here.
  const tasks: Task[] = [];

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
