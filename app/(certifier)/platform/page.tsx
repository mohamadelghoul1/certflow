import Link from "next/link";
import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Building2, TrendingUp, Receipt } from "lucide-react";
import { chargeFor, monthKey, monthLabel, monthsSince, money, planFor, rateLabel, statementLines, DEFAULT_PLAN, type FirmPlan, type FirmUsageRow } from "@/lib/billing";
import { FirmPlanForm } from "@/components/certifier/FirmPlanForm";

export const metadata = { title: "Firms — Certlyn" };

// What every firm has used, and what each owes for it.
//
// The owner's page, not a firm's: it is the only screen in Certlyn that
// looks across firms at all, and the database refuses it to anybody
// else (is_platform_owner, migration 0076). Nothing here bills anyone —
// it is the month's numbers, so an invoice can be raised from something
// other than memory.
export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  await requirePlatformOwner();
  const supabase = await createClient();

  const thisMonth = monthKey();
  const key = /^\d{4}-\d{2}$/.test(month || "") ? (month as string) : thisMonth;

  const [{ data: usageRows, error: usageError }, { data: planRows }] = await Promise.all([
    supabase.rpc("firm_usage", { p_month: key }),
    supabase.from("firm_plans").select("*"),
  ]);

  if (usageError) {
    return (
      <div>
        <h1 className="text-xl font-bold text-primary mb-4">Firms</h1>
        <div className="rounded-lg border border-warning/50 bg-warning-bg px-5 py-4 text-sm text-warning-text max-w-2xl">
          Run database update 0076 in Supabase and this page starts working — see Settings → System check.
        </div>
      </div>
    );
  }

  const usage = (usageRows || []) as FirmUsageRow[];
  const plans = (planRows || []) as FirmPlan[];
  const rows = usage.map((firm) => {
    const plan = planFor(plans, firm.firm_id);
    return { firm, plan, charge: plan ? chargeFor(plan, key, Number(firm.billable_projects)) : null };
  });

  const earliest = usage.map((f) => f.created_on?.slice(0, 7)).filter(Boolean).sort()[0] || thisMonth;
  const months = monthsSince(earliest, thisMonth);
  const billed = rows.reduce((sum, r) => sum + (r.charge?.totalCents || 0), 0);
  const projects = rows.reduce((sum, r) => sum + Number(r.firm.billable_projects), 0);
  const overage = rows.reduce((sum, r) => sum + (r.charge?.extra || 0), 0);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-xl font-bold text-primary">Firms</h1>
          <p className="text-sm text-muted mt-0.5">What each firm has used this month, and what it comes to.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* A plain list of links rather than a dropdown: it is a page
              the owner opens once a month, and a link can be bookmarked
              and shared with a bookkeeper. */}
          <label className="text-xs text-muted">Month</label>
          <div className="flex gap-1 overflow-x-auto max-w-[420px]" style={{ scrollbarWidth: "none" }}>
            {months.slice(0, 14).map((m) => (
              <Link
                key={m}
                href={`/platform?month=${m}`}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap ${m === key ? "bg-primary text-white font-semibold" : "text-muted hover:bg-hover"}`}
              >
                {monthLabel(m)}
              </Link>
            ))}
          </div>
          <a href={`/api/platform/usage?month=${key}`} className="shrink-0 text-xs font-semibold text-secondary hover:underline whitespace-nowrap">
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Tile icon={Building2} label="Firms" value={String(rows.length)} />
        <Tile icon={TrendingUp} label="New projects" value={String(projects)} detail="imported projects not counted" />
        <Tile icon={TrendingUp} label="Over the included number" value={String(overage)} />
        <Tile icon={Receipt} label="To invoice" value={money(billed)} detail={monthLabel(key)} />
      </div>

      <div className="space-y-4">
        {rows.length === 0 && <div className="text-sm text-placeholder">No firms yet.</div>}
        {rows.map(({ firm, plan, charge }) => (
          <section key={firm.firm_id} className="bg-white rounded-lg border border-line">
            <div className="px-5 py-3 border-b border-line flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-bold text-primary">{firm.firm_name}</div>
                <div className="text-[11px] text-placeholder">
                  With Certlyn since {firm.created_on?.slice(0, 10) || "—"}
                  {charge ? ` · ${rateLabel(charge, plan!)}` : " · no terms set yet"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-heading">{charge ? money(charge.totalCents) : "—"}</div>
                <div className="text-[11px] text-placeholder">{monthLabel(key)}</div>
              </div>
            </div>

            <div className="px-5 py-4 grid sm:grid-cols-[1fr_1fr] gap-5">
              <div>
                <div className="text-xs font-semibold text-muted mb-2">This month</div>
                <dl className="text-sm space-y-1.5">
                  <Row label="New projects created" value={String(firm.billable_projects)} />
                  <Row label="Included in the fee" value={charge ? String(charge.included) : "—"} />
                  <Row label="Over the included number" value={charge ? String(charge.extra) : "—"} strong={!!charge && charge.extra > 0} />
                  <Row label="Brought across (not charged)" value={String(firm.imported_projects)} />
                </dl>
                {charge && (
                  <div className="mt-3 rounded-md border border-line bg-surface p-3">
                    <div className="text-[11px] font-semibold text-muted mb-1.5">For the invoice</div>
                    {statementLines(charge, plan!).map((line) => (
                      <div key={line.text} className="flex justify-between gap-3 text-xs text-muted py-0.5">
                        <span>{line.text}</span>
                        <span className="font-semibold text-heading whitespace-nowrap">{money(line.cents)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-3 text-xs border-t border-line mt-1.5 pt-1.5">
                      <span className="font-semibold text-heading">Total (excluding GST)</span>
                      <span className="font-bold text-heading">{money(charge.totalCents)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-muted mb-2">Their terms</div>
                <FirmPlanForm firmId={firm.firm_id} plan={plan} defaults={DEFAULT_PLAN} />
              </div>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 text-[11px] text-placeholder max-w-2xl">
        A project counts in the month it was created, in Sydney time, and keeps counting even if it is deleted later. Projects brought across from
        another system when a firm joins are never counted. Amounts exclude GST.
      </p>
    </div>
  );
}

function Tile({ icon: Icon, label, value, detail }: { icon: typeof Building2; label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <Icon size={13} className="text-icon" /> {label}
      </div>
      <div className="text-xl font-bold text-heading mt-1">{value}</div>
      {detail && <div className="text-[11px] text-placeholder">{detail}</div>}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? "font-bold text-warning-text" : "font-semibold text-heading"}>{value}</dd>
    </div>
  );
}
