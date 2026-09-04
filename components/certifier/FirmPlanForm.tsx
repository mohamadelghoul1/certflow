"use client";

import { useActionState, useState } from "react";
import { saveFirmPlan } from "@/lib/actions/plans";
import { money, type FirmPlan } from "@/lib/billing";
import { DateField } from "@/components/DateField";
import type { ActionState } from "@/lib/actions/auth";

const inputCls = "w-full px-2 py-1.5 rounded border border-line text-xs outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-[11px] text-placeholder mb-1";

function dollars(cents: number | undefined, fallback: number): string {
  return ((cents ?? fallback) / 100).toFixed(2);
}

// What one firm is charged. Read-only until Change is pressed, because
// this is the page the owner reads far more often than edits.
export function FirmPlanForm({
  firmId,
  plan,
  defaults,
}: {
  firmId: string;
  plan: FirmPlan | null;
  defaults: { intro_until: string; intro_fee_cents: number; standard_fee_cents: number; included_projects: number; extra_project_fee_cents: number };
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await saveFirmPlan(prev, fd);
    if (!result?.error) setEditing(false);
    return result;
  }, undefined);

  if (!editing) {
    return (
      <div className="text-sm">
        {plan ? (
          <dl className="space-y-1.5 text-xs">
            <Line label="Starts" value={plan.started_on} />
            <Line label="Introductory rate" value={`${money(plan.intro_fee_cents)} a month until ${plan.intro_until}`} />
            <Line label="After that" value={`${money(plan.standard_fee_cents)} a month`} />
            <Line label="Projects included" value={`${plan.included_projects} a month`} />
            <Line label="Each one over" value={money(plan.extra_project_fee_cents)} />
            {plan.notes && <p className="text-[11px] text-muted whitespace-pre-wrap pt-1">{plan.notes}</p>}
          </dl>
        ) : (
          <p className="text-xs text-muted">
            No terms set for this firm, so nothing is being counted against a fee. Set them and this month starts adding up.
          </p>
        )}
        <button onClick={() => setEditing(true)} className="mt-2 text-xs font-semibold text-secondary hover:underline">
          {plan ? "Change these terms" : "Set their terms"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="firm_id" value={firmId} />
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>Arrangement starts</label>
          <DateField name="started_on" defaultValue={plan?.started_on || new Date().toISOString().slice(0, 10)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Introductory rate until</label>
          <DateField name="intro_until" defaultValue={plan?.intro_until || defaults.intro_until} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Introductory fee / month</label>
          <input name="intro_fee" inputMode="decimal" defaultValue={dollars(plan?.intro_fee_cents, defaults.intro_fee_cents)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Fee after that / month</label>
          <input name="standard_fee" inputMode="decimal" defaultValue={dollars(plan?.standard_fee_cents, defaults.standard_fee_cents)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>New projects included</label>
          <input name="included_projects" type="number" min={0} defaultValue={plan?.included_projects ?? defaults.included_projects} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Each project over that</label>
          <input name="extra_project_fee" inputMode="decimal" defaultValue={dollars(plan?.extra_project_fee_cents, defaults.extra_project_fee_cents)} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes (only you see these)</label>
        <textarea name="notes" rows={2} defaultValue={plan?.notes || ""} className={inputCls} />
      </div>
      {state?.error && <div className="text-xs text-error">{state.error}</div>}
      <div className="flex gap-2">
        <button disabled={pending} className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save terms"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-muted hover:bg-hover">
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-placeholder">
        Amounts in dollars, excluding GST. Billing runs by the calendar month: a firm starting part-way through one pays that month in full.
      </p>
    </form>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-heading text-right">{value}</dd>
    </div>
  );
}
