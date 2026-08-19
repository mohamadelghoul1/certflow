import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { stageComplete, unresolvedCount, daysUntil, calcCdcLapseDate, portalReportDeadline } from "@/lib/business";
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
  status: "active" | "complete";
  details: { certificateDetails?: { determinationDate?: string } };
  pathway_generated: boolean;
  pathway_generated_date: string | null;
  pathway_portal_reported: boolean;
  checklists: { kind: string; checklist_items: { status: string; amendments: { resolved: boolean }[] }[] }[];
  inspections: { id: string; outcome: string; date: string | null; booked_by_client: boolean; confirmed: boolean; title: string; portal_reported: boolean }[];
  oc_records: { id: string; type: string; generated_date: string | null; portal_reported: boolean }[];
};

export default async function DashboardPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, address, description, pathway, status, details, pathway_generated, pathway_generated_date, pathway_portal_reported, " +
        "checklists(id, kind, checklist_items(id, status, amendments(id, resolved))), " +
        "inspections(id, outcome, booked_by_client, confirmed, title, date, portal_reported), " +
        "oc_records(id, type, generated_date, portal_reported)"
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
    const openAmendments = allItems.reduce((sum, i) => sum + unresolvedCount(i as never), 0);
    if (openAmendments > 0) {
      tasks.push({ priority: "High", text: `${openAmendments} open amendment point${openAmendments === 1 ? "" : "s"} awaiting client — ${p.address}`, jobId: p.id, href });
    }
    const awaitingReview = allItems.filter((i) => i.status === "submitted" && unresolvedCount(i as never) === 0).length;
    if (awaitingReview > 0) {
      tasks.push({ priority: "Medium", text: `${awaitingReview} document${awaitingReview === 1 ? "" : "s"} submitted — awaiting your review — ${p.address}`, jobId: p.id, href });
    }
    const unconfirmed = (p.inspections || []).filter((i) => i.booked_by_client && !i.confirmed);
    for (const i of unconfirmed) {
      tasks.push({ priority: "High", text: `Inspection booked by client — ${i.title} on ${i.date} — needs confirmation — ${p.address}`, jobId: p.id, href: `${href}?tab=inspections` });
    }
    const pathwayChecklist = (p.checklists || []).find((c) => c.kind === "pathway");
    if (pathwayChecklist && stageComplete(pathwayChecklist.checklist_items as never) && !p.pathway_generated) {
      tasks.push({ priority: "Medium", text: `Ready to generate ${p.pathway} certificate — ${p.address}`, jobId: p.id, href });
    }
    const ocChecklist = (p.checklists || []).find((c) => c.kind === "oc");
    const ocRecords = p.oc_records || [];
    if (p.pathway_generated && ocChecklist && stageComplete(ocChecklist.checklist_items as never) && p.status !== "complete" && ocRecords.length === 0) {
      tasks.push({ priority: "Medium", text: `Ready to issue Occupation Certificate — ${p.address}`, jobId: p.id, href: `${href}?tab=oc` });
    }
    if (ocRecords.some((r) => r.type === "whole")) {
      tasks.push({ priority: "Low", text: `Whole OC issued — ready to mark project complete — ${p.address}`, jobId: p.id, href });
    }
    const pending = (p.inspections || []).filter((i) => i.outcome === "pending").length;
    if (p.pathway_generated && pending > 0) {
      tasks.push({ priority: "Medium", text: `${pending} inspection${pending === 1 ? "" : "s"} awaiting outcome — ${p.address}`, jobId: p.id, href: `${href}?tab=inspections` });
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

    // Build Brief §9: CDC/CC/OC issuance and critical stage inspections must
    // be reported to the NSW Planning Portal within 2 business days.
    if (p.pathway_generated && p.pathway_generated_date && !p.pathway_portal_reported) {
      const deadline = daysUntil(portalReportDeadline(p.pathway_generated_date));
      if (deadline !== null && deadline <= 2) {
        tasks.push({
          priority: "High",
          text: deadline < 0 ? `${p.pathway} Planning Portal report overdue — ${p.address}` : `Report ${p.pathway} to NSW Planning Portal within ${deadline} day${deadline === 1 ? "" : "s"} — ${p.address}`,
          jobId: p.id,
          href,
        });
      }
    }
    for (const r of p.oc_records || []) {
      if (!r.generated_date || r.portal_reported) continue;
      const deadline = daysUntil(portalReportDeadline(r.generated_date));
      if (deadline !== null && deadline <= 2) {
        tasks.push({
          priority: "High",
          text: deadline < 0 ? `OC Planning Portal report overdue — ${p.address}` : `Report OC to NSW Planning Portal within ${deadline} day${deadline === 1 ? "" : "s"} — ${p.address}`,
          jobId: p.id,
          href: `${href}?tab=oc`,
        });
      }
    }
    for (const i of p.inspections || []) {
      if (i.outcome === "pending" || !i.date || i.portal_reported) continue;
      const deadline = daysUntil(portalReportDeadline(i.date));
      if (deadline !== null && deadline <= 2) {
        tasks.push({
          priority: "High",
          text: deadline < 0 ? `Inspection Planning Portal report overdue — ${i.title} — ${p.address}` : `Report inspection to NSW Planning Portal within ${deadline} day${deadline === 1 ? "" : "s"} — ${i.title} — ${p.address}`,
          jobId: p.id,
          href: `${href}?tab=inspections`,
        });
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
