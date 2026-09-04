import { monthLabel, money, chargeFor, rateLabel, type FirmPlan } from "@/lib/billing";

// What a firm sees of its own arrangement: this month's count against
// what the fee covers, so a bill is never the first they hear of it.
export function PlanUsageSection({ plan, used, monthKey }: { plan: FirmPlan | null; used: number; monthKey: string }) {
  if (!plan) {
    return (
      <div className="text-sm text-muted max-w-xl">
        <p>
          {used} new project{used === 1 ? "" : "s"} created in {monthLabel(monthKey)}.
        </p>
        <p className="mt-2 text-xs text-placeholder">
          No subscription terms are recorded for your firm, so nothing is being counted against a fee. Projects brought across from another system are
          never counted.
        </p>
      </div>
    );
  }

  const charge = chargeFor(plan, monthKey, used);
  const proportion = charge.included > 0 ? Math.min(100, Math.round((used / charge.included) * 100)) : 100;
  const over = charge.extra > 0;

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-heading">
              {used} <span className="text-base font-medium text-muted">of {charge.included} new projects</span>
            </div>
            <div className="text-xs text-placeholder">{monthLabel(monthKey)} · {rateLabel(charge, plan)}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-heading">{money(charge.totalCents)}</div>
            <div className="text-[11px] text-placeholder">this month, excluding GST</div>
          </div>
        </div>
        <div className="mt-2 h-2 rounded-full bg-hover overflow-hidden">
          <div className={`h-full ${over ? "bg-warning" : "bg-secondary"}`} style={{ width: `${proportion}%` }} />
        </div>
        {over && (
          <p className="mt-2 text-xs text-warning-text">
            {charge.extra} project{charge.extra === 1 ? "" : "s"} past the {charge.included} your fee covers, at {money(plan.extra_project_fee_cents)}{" "}
            each — {money(charge.extraCents)} on top of this month&rsquo;s {money(charge.feeCents)}.
          </p>
        )}
      </div>

      <dl className="text-sm space-y-1.5 border-t border-line pt-3">
        <Line label="Monthly fee" value={`${money(charge.feeCents)}${charge.intro ? ` (introductory rate, until ${plan.intro_until})` : ""}`} />
        <Line label="New projects included" value={`${plan.included_projects} a month`} />
        <Line label="Each project over that" value={money(plan.extra_project_fee_cents)} />
        <Line label="Arrangement started" value={plan.started_on} />
      </dl>

      <p className="text-[11px] text-placeholder">
        Billing runs by the calendar month, whatever day of it you started on. A project counts in the month it was created and keeps counting if it is
        deleted later. Projects brought across from another system when you joined are never counted. Amounts exclude GST.
      </p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-heading">{value}</dd>
    </div>
  );
}
