import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { countJob } from "@/lib/dashboardCounts";
import { invoiceTotals, receivablesSummary, formatMoney } from "@/lib/invoices/invoiceLogic";
import { unresolvedCount, daysUntil, calcCdcLapseDate, formatISODate, todayISO } from "@/lib/business";
import { getAuditEvents, getIssuanceEvents } from "@/lib/reporting";
import { excludingDeleted } from "@/lib/softDelete";
import Link from "next/link";
import { DashboardSearch } from "@/components/certifier/DashboardSearch";
import { TaskBoard } from "@/components/certifier/TaskBoard";
import { ProjectsDonut } from "@/components/certifier/ProjectsDonut";
import { AlertTriangle, Building2, CalendarCheck, ClipboardCheck, Activity, CalendarClock, ShieldCheck, Inbox, Zap, Plus, FilePlus, UserPlus, BarChart3, PieChart, HardHat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TaskList, ManualTask } from "@/types/db";

type Task = { priority: "High" | "Medium" | "Low"; text: string; jobId: string | null; href: string };

// A compact tile. `tone` marks the one that means "something is wrong",
// which is the only place red appears on this page — green stays reserved
// for approved, as everywhere else in the app.
function Tile({ icon: Icon, label, value, href, tone, detail, className = "" }: { icon: LucideIcon; label: string; value: number; href: string; tone?: "alert"; detail?: string; className?: string }) {
  const alert = tone === "alert" && value > 0;
  return (
    // h-full so a tile whose label runs to two lines doesn't leave the row
    // ragged — they all take the height of the tallest.
    <Link href={href} className={`card-lift h-full flex flex-col rounded-xl border bg-white p-4 shadow-sm ${alert ? "border-error/40" : "border-line"} ${className}`}>
      <Icon size={18} strokeWidth={1.6} className={alert ? "text-error" : "text-icon"} />
      <div className={`text-3xl font-bold mt-2 ${alert ? "text-error" : "text-heading"}`}>{value}</div>
      <div className="text-xs font-medium text-muted mt-1 leading-snug">{label}</div>
      {detail && <div className="text-[11px] text-placeholder mt-auto pt-1">{detail}</div>}
    </Link>
  );
}

function Panel({ title, icon: Icon, viewAllHref, children }: { title: string; icon: LucideIcon; viewAllHref?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-line">
        <span className="flex items-center gap-2">
          <Icon size={15} className="text-icon" />
          <span className="text-sm font-semibold text-heading">{title}</span>
        </span>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-xs font-medium text-secondary hover:underline shrink-0">
            View all
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 hover:bg-hover text-center">
      <Icon size={19} strokeWidth={1.6} className="text-icon group-hover:text-icon-300" />
      <span className="text-[11px] font-medium text-heading leading-tight">{label}</span>
    </Link>
  );
}

function EmptyPanel({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="px-4 py-10 flex flex-col items-center text-center">
      <Icon size={34} strokeWidth={1.25} className="text-placeholder mb-2" />
      <div className="text-sm text-muted">{message}</div>
    </div>
  );
}

function getGreeting() {
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney", hour: "numeric", hour12: false }));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type DashboardJob = {
  id: string;
  address: string;
  description: string | null;
  pathway: "CDC" | "CC";
  status: "active" | "complete";
  pathway_generated: boolean;
  created_at: string;
  details: { certificateDetails?: { determinationDate?: string } };
  checklists: { kind: string; checklist_items: { status: string; amendments: { resolved: boolean }[] }[] }[];
  inspections: { id: string; title: string; date: string | null; outcome: string; booked_by_client: boolean; confirmed: boolean }[];
};

export default async function DashboardPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const [{ data: jobs }, { data: certifiers }, { data: taskLists }, { data: manualTasks }, auditEvents, issuanceEvents] = await Promise.all([
    excludingDeleted((live) => {
      const query = supabase
        .from("jobs")
        .select(
          "id, address, description, pathway, status, pathway_generated, created_at, details, " +
            "checklists(kind, checklist_items(status, amendments(resolved))), " +
            "inspections(id, title, date, outcome, booked_by_client, confirmed)"
        )
        .eq("firm_id", profile.firm_id);
      return (live ? query.is("deleted_at", null) : query).returns<DashboardJob[]>();
    }),
    supabase.from("certifiers").select("id, name, pi_insurance_expiry, registration_expiry").eq("firm_id", profile.firm_id),
    supabase.from("task_lists").select("*").eq("firm_id", profile.firm_id).order("sort_order"),
    supabase.from("manual_tasks").select("*, task_lists!inner(firm_id)").eq("task_lists.firm_id", profile.firm_id).order("sort_order"),
    getAuditEvents(supabase, profile.firm_id),
    getIssuanceEvents(supabase, profile.firm_id),
  ]);
  const allJobs = jobs || [];
  const activeJobs = allJobs.filter((j) => j.status === "active");

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

  for (const p of activeJobs) {
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

  // The numbers the tiles and the work queue report, all derived from the
  // same pass over the jobs rather than counted twice in different ways.
  const today = todayISO();
  const inspectionsToday: { jobId: string; address: string; title: string; inspector: string | null }[] = [];
  let assessmentsInProgress = 0;
  let approvalsToIssue = 0;
  let documentsForReview = 0;
  let ocAssessments = 0;
  const stageCounts = { assessment: 0, readyToIssue: 0, awaitingCommencement: 0, underConstruction: 0, complete: 0 };

  for (const p of allJobs) {
    // One place decides what a job counts as — see lib/dashboardCounts.ts.
    const counts = countJob(p as never);
    stageCounts[counts.stage] += 1;
    if (counts.pathwayAssessment) assessmentsInProgress += 1;
    if (counts.approvalToIssue) approvalsToIssue += 1;
    if (counts.ocAssessment) ocAssessments += 1;
    documentsForReview += counts.documentsForReview;

    for (const i of p.inspections || []) {
      if (i.date === today) inspectionsToday.push({ jobId: p.id, address: p.address, title: i.title, inspector: null });
    }
  }

  upcomingInspections.sort((a, b) => a.daysAway - b.daysAway);
  const nextInspections = upcomingInspections.slice(0, 5);

  // The strip along the bottom is what the practice has actually done
  // lately. Everything above it is work outstanding, so nothing here
  // repeats a tile: "overdue items" was a subset of the attention count,
  // and "active projects" is what the ring already breaks down.
  const now = new Date();
  const sameMonth = (value: Date) => value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const certificatesThisMonth = issuanceEvents.filter((e) => sameMonth(e.date)).length;
  const inspectionsThisMonth = allJobs.reduce(
    (sum, p) => sum + (p.inspections || []).filter((i) => i.date?.startsWith(monthPrefix) && i.outcome !== "pending").length,
    0
  );
  const projectsStartedThisMonth = allJobs.filter((p) => p.created_at?.startsWith(monthPrefix)).length;

  // What's owed, straight from the invoices. On a database still waiting
  // on migration 0034 both queries return nothing and the strip stays off
  // the page rather than erroring.
  const [{ data: invoiceRows }, { data: invoiceLineRows }] = await Promise.all([
    supabase.from("invoices").select("id, status, due_date").eq("firm_id", profile.firm_id),
    supabase.from("invoice_lines").select("invoice_id, amount"),
  ]);
  const invoiceLinesById = new Map<string, { amount: number }[]>();
  for (const line of invoiceLineRows || []) {
    const group = invoiceLinesById.get(line.invoice_id) || [];
    group.push({ amount: line.amount });
    invoiceLinesById.set(line.invoice_id, group);
  }
  const receivables = receivablesSummary(
    (invoiceRows || []).map((invoice) => ({ ...invoice, total: invoiceTotals(invoiceLinesById.get(invoice.id) || []).total })),
    todayISO()
  );

  const recentActivity = [...auditEvents].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 6);
  const firstName = (profile.full_name || profile.email || "there").split(/[\s@]/)[0];

  return (
    <div className="px-2 sm:px-4 py-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-heading tracking-tight">Dashboard</h1>
        <p className="text-muted mt-1">
          {getGreeting()}, {firstName}. Here&rsquo;s what&rsquo;s happening today.
        </p>
      </div>

      <div className="max-w-lg">
        <DashboardSearch jobs={activeJobs.map((p) => ({ id: p.id, address: p.address, description: p.description || "", pathway: p.pathway }))} />
      </div>

      {/* Two columns from large screens down to one on a phone, where the
          order below is the order it reads in: what needs doing first,
          then what's on today, then the rest. */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-stretch">
        <Tile icon={AlertTriangle} label="Actions require attention" value={tasks.length} href="#attention" tone="alert" />
        <Tile icon={CalendarCheck} label="Inspections today" value={inspectionsToday.length} href="#today" />
        <Tile
          icon={ClipboardCheck}
          label="Assessments in progress"
          value={assessmentsInProgress + ocAssessments}
          href="/jobs"
          detail={`CDC/CC ${assessmentsInProgress} · OC ${ocAssessments}`}
        />
        <Tile icon={ShieldCheck} label="Approvals to issue" value={approvalsToIssue} href="/jobs" />
        {/* Five tiles into a two-column grid leaves the last one stranded on
            its own row, so on a phone it takes the full width. */}
        <Tile icon={Inbox} label="Documents for review" value={documentsForReview} href="/jobs" className="col-span-2 md:col-span-1" />
      </div>

      {receivables.outstanding > 0 && (
        <Link
          href="/invoices"
          className={`card-lift mt-3 flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm ${receivables.overdueCount > 0 ? "border-error/40" : "border-line"}`}
        >
          <span className="text-sm text-muted">
            <span className="font-bold text-heading">{formatMoney(receivables.outstanding)}</span> owed to you
            {receivables.overdueCount > 0 && (
              <span className="text-error font-semibold">
                {" "}— {formatMoney(receivables.overdue)} overdue on {receivables.overdueCount} invoice{receivables.overdueCount === 1 ? "" : "s"}
              </span>
            )}
          </span>
          <span className="text-xs font-semibold text-secondary shrink-0">View invoices →</span>
        </Link>
      )}

      <div className="mt-6 grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 min-w-0 space-y-5">
          <div id="today">
            <Panel title="Today&rsquo;s inspections" icon={CalendarCheck} viewAllHref="/jobs">
              {inspectionsToday.length === 0 ? (
                <EmptyPanel icon={CalendarCheck} message="Nothing booked for today." />
              ) : (
                inspectionsToday.map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-line first:border-t-0 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-heading truncate">{i.title}</div>
                      <div className="text-xs text-muted truncate">{i.address}</div>
                    </div>
                    <Link
                      href={`/jobs/${i.jobId}?tab=inspections`}
                      className="shrink-0 text-sm font-medium text-white bg-secondary hover:opacity-90 rounded-full px-4 py-1.5 whitespace-nowrap"
                    >
                      Open inspection
                    </Link>
                  </div>
                ))
              )}
            </Panel>
          </div>

          <div id="attention">
            {tasks.length > 0 ? (
              <Panel title="Actions require attention" icon={AlertTriangle}>
                {tasks.slice(0, 8).map((t, i) => {
                  const dot = t.priority === "High" ? "bg-error" : t.priority === "Medium" ? "bg-warning" : "bg-placeholder";
                  return (
                    <Link key={i} href={t.href} className="px-5 py-3 border-t border-line first:border-t-0 hover:bg-hover flex items-start gap-3">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                      <div className="text-sm text-muted">{t.text}</div>
                    </Link>
                  );
                })}
              </Panel>
            ) : (
              <div className="rounded-xl border border-line bg-white shadow-sm">
                <EmptyPanel icon={ShieldCheck} message="All clear — no pending actions at the moment." />
              </div>
            )}
          </div>

          <Panel title="Quick actions" icon={Zap}>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 p-3">
              <QuickAction href="/site" icon={HardHat} label="On site" />
              <QuickAction href="/jobs/new" icon={Plus} label="New project" />
              <QuickAction href="/quotes/new" icon={FilePlus} label="New quote" />
              <QuickAction href="/jobs" icon={Building2} label="All projects" />
              <QuickAction href="/settings" icon={UserPlus} label="Add client" />
              <QuickAction href="/audit?section=reports" icon={BarChart3} label="Reports" />
            </div>
          </Panel>

        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Upcoming inspections" icon={CalendarClock}>
            {nextInspections.length === 0 ? (
              <EmptyPanel icon={CalendarClock} message="Nothing booked." />
            ) : (
              nextInspections.map((u, i) => (
                <Link key={i} href={`/jobs/${u.jobId}?tab=inspections`} className="flex items-start justify-between gap-3 px-5 py-3 border-t border-line first:border-t-0 hover:bg-hover">
                  <div className="min-w-0">
                    <div className="text-sm text-muted truncate">{u.title}</div>
                    <div className="text-xs text-muted truncate">{u.address}</div>
                  </div>
                  <div className="text-xs font-medium text-secondary shrink-0 whitespace-nowrap">{formatISODate(u.date)}</div>
                </Link>
              ))
            )}
          </Panel>

          <Panel title="Recent activity" icon={Activity} viewAllHref="/audit">
            {recentActivity.length === 0 ? (
              <EmptyPanel icon={Inbox} message="No activity yet." />
            ) : (
              recentActivity.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-3 px-5 py-3 border-t border-line first:border-t-0">
                  <div className="min-w-0">
                    <div className="text-sm text-muted truncate">{e.action}</div>
                    <div className="text-xs text-muted truncate">{e.address}</div>
                  </div>
                  <div className="text-xs text-muted shrink-0 whitespace-nowrap">{formatISODate(e.date)}</div>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Projects overview" icon={PieChart} viewAllHref="/jobs">
            <div className="p-5">
              <ProjectsDonut
                slices={[
                  { label: "In assessment", value: stageCounts.assessment, color: "#2FA6A0", href: "/jobs" },
                  { label: "Ready to issue", value: stageCounts.readyToIssue, color: "#F9A825", href: "/jobs" },
                  { label: "Awaiting commencement", value: stageCounts.awaitingCommencement, color: "#8E44AD", href: "/jobs" },
                  { label: "Under construction", value: stageCounts.underConstruction, color: "#1A3A5F", href: "/jobs" },
                  { label: "Complete", value: stageCounts.complete, color: "#2E7D32", href: "/jobs" },
                ]}
              />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="px-5 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">This month</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line">
          {[
            { icon: ShieldCheck, label: "Certificates issued", value: certificatesThisMonth },
            { icon: CalendarCheck, label: "Inspections carried out", value: inspectionsThisMonth },
            { icon: Building2, label: "Projects started", value: projectsStartedThisMonth },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-4">
              <Icon size={17} strokeWidth={1.6} className="text-icon" />
              <div className="min-w-0">
                <div className="text-xs text-muted leading-tight">{label}</div>
                <div className="text-xl font-bold text-heading">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-heading mb-3">Tasks</h2>
        {listsWithTasks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {listsWithTasks.map((l) => {
              const open = l.tasks.filter((t) => !t.completed).length;
              return (
                <span
                  key={l.id}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
                    open > 0 ? "bg-white border-secondary/40 text-secondary" : "bg-surface border-line text-muted"
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
