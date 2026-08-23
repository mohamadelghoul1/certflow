"use client";

import { useActionState, useState } from "react";
import { createQuote } from "@/lib/actions/quotes";
import type { ActionState } from "@/lib/actions/auth";
import { NSW_STATE, JOB_TYPES, BUILDING_CLASSIFICATIONS, defaultScopeOfWorks } from "@/lib/constants";
import { X, Plus } from "lucide-react";
import { DateField, todayISO } from "@/components/DateField";
import { AddressLookupField } from "@/components/certifier/AddressLookupField";
import { ApplicantAddressField } from "@/components/certifier/ApplicantAddressField";

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-xs font-semibold text-placeholder mb-1";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-line mb-5">
      <div className="px-5 py-3 border-b border-line font-bold text-primary">{title}</div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

type FeeLine = { description: string; amount: string };

export function NewQuoteForm({ certifiers, clients }: { certifiers: { id: string; name: string }[]; clients: { id: string; name: string; type: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createQuote, undefined);
  const [pathway, setPathway] = useState<"CDC" | "CC">("CDC");
  const [proposalAddress, setProposalAddress] = useState("");
  const [lotSectionPlan, setLotSectionPlan] = useState("");
  const [councilLga, setCouncilLga] = useState("");
  const [ownerIsApplicant, setOwnerIsApplicant] = useState(true);
  const [scopeItems, setScopeItems] = useState<string[]>(defaultScopeOfWorks("CDC"));
  const [feeLines, setFeeLines] = useState<FeeLine[]>([{ description: "CDC/PC/OC", amount: "2500" }]);

  function handlePathwayChange(p: "CDC" | "CC") {
    setPathway(p);
    setFeeLines((prev) => (prev.length === 1 && prev[0].description === `${pathway}/PC/OC` ? [{ ...prev[0], description: `${p}/PC/OC` }] : prev));
  }

  const subtotal = feeLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  return (
    <form action={formAction}>
      <Section title="Quote details">
        <div>
          <label className={labelCls}>Quote number</label>
          <input name="quote_number" placeholder="Leave blank to use the automatic number" autoComplete="off" className={inputCls} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>State</label>
            <select name="state" defaultValue="NSW" className={inputCls}>
              {NSW_STATE.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Project type</label>
            {/* A plain text box backed by the standard list, so the usual
                types are one click away but anything can be typed in —
                a quote arrives before the job is pinned down. */}
            <input name="project_type" list="quote-project-types" placeholder="Pick from the list or type your own" autoComplete="off" className={inputCls} />
            <datalist id="quote-project-types">
              {JOB_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>
        <div>
          <label className={labelCls}>Pathway — used if this quote converts into a project</label>
          <div className="flex gap-2">
            {(["CDC", "CC"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePathwayChange(p)}
                className={`flex-1 py-2 rounded-md text-sm font-semibold border ${pathway === p ? "bg-primary text-white border-primary" : "border-line text-muted hover:bg-hover"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <input type="hidden" name="pathway" value={pathway} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Required start date</label>
            {/* The start is when the engagement began, so it can't be a
                future day; the end is a deadline, so it can't already have
                passed. Inside those bounds the calendar picks freely. */}
            <DateField name="required_start_date" max={todayISO()} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Required end date</label>
            <DateField name="required_end_date" min={todayISO()} className={inputCls} />
          </div>
        </div>
      </Section>

      <Section title="Proposal">
        <AddressLookupField
          addressLabel="Proposal address"
          addressName="proposal_address"
          lotName="lot_section_plan"
          address={proposalAddress}
          onAddressChange={setProposalAddress}
          lotSectionDp={lotSectionPlan}
          onLotSectionDpChange={setLotSectionPlan}
          onCouncilMatched={setCouncilLga}
          councilLga={councilLga}
          showZoning={false}
          required
          lotRequired={false}
        />
        <div>
          <label className={labelCls}>Certifier</label>
          <select name="certifier_id" className={inputCls} defaultValue="">
            <option value="">— Select —</option>
            {certifiers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Building classification(s)</label>
          <div className="flex flex-wrap gap-3">
            {BUILDING_CLASSIFICATIONS.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" name="classifications" value={c} className="accent-icon" />
                {c}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Job description</label>
          <textarea name="development_description" rows={2} placeholder="e.g. Construction of a new two-storey dwelling" className={inputCls} />
          <div className="text-[11px] text-placeholder mt-1">Carried straight onto the project as its description when this quote is accepted and converted.</div>
        </div>
      </Section>

      <Section title="Contact details">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="owner_is_applicant" checked={ownerIsApplicant} onChange={(e) => setOwnerIsApplicant(e.target.checked)} className="accent-icon" />
          Owner is the applicant
        </label>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Applicant full name</label>
            <input name="applicant_name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Applicant phone</label>
            <input name="applicant_phone" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Applicant email</label>
            <input type="email" name="applicant_email" className={inputCls} />
          </div>
        </div>
        <ApplicantAddressField />
        <div>
          <label className={labelCls}>Client — link this quote to a client so it can flow through to the project automatically</label>
          <select name="client_id" className={inputCls} defaultValue="">
            <option value="">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>
        {!ownerIsApplicant && (
          <div className="grid sm:grid-cols-3 gap-4 border-t border-line pt-4">
            <div>
              <label className={labelCls}>Owner name</label>
              <input name="owner_name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Owner phone</label>
              <input name="owner_phone" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Owner email</label>
              <input type="email" name="owner_email" className={inputCls} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Council">
        <div>
          <label className={labelCls}>Local Government Area</label>
          <input name="council_lga" value={councilLga} onChange={(e) => setCouncilLga(e.target.value)} placeholder="Search for and select the council area" className={inputCls} />
        </div>
      </Section>

      <Section title="Scope of works">
        <div className="space-y-2">
          {scopeItems.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                name="scope_item"
                value={item}
                onChange={(e) => setScopeItems((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))}
                className={inputCls}
              />
              <button type="button" onClick={() => setScopeItems((prev) => prev.filter((_, i) => i !== idx))} className="p-2 rounded-full hover:bg-surface text-placeholder">
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setScopeItems((prev) => [...prev, ""])} className="flex items-center gap-1.5 text-sm text-secondary font-medium hover:underline">
            <Plus size={14} /> Add scope item
          </button>
        </div>
      </Section>

      <Section title="Fee">
        <div className="space-y-2">
          <div className="flex gap-2 items-center text-xs text-placeholder px-1">
            <span className="flex-1">Description</span>
            <span className="w-24 text-right pr-8">Fee</span>
          </div>
          {feeLines.map((line, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              {/* The ref and onInput keep the box exactly as tall as its
                  text, so a long description wraps onto more lines while a
                  short one stays a single row. Sized with flex, not
                  field-sizing: that collapsed the box to its narrowest
                  content instead of filling the row. */}
              <textarea
                name="fee_description"
                value={line.description}
                onChange={(e) => setFeeLines((prev) => prev.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l)))}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight + 2}px`;
                  }
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight + 2}px`;
                }}
                placeholder="Describe the item — e.g. Complying Development Certificate assessment and issue"
                rows={1}
                className="flex-1 min-w-0 px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon resize-none overflow-hidden"
              />
              <input
                type="number"
                name="fee_amount"
                value={line.amount}
                onChange={(e) => setFeeLines((prev) => prev.map((l, i) => (i === idx ? { ...l, amount: e.target.value } : l)))}
                placeholder="0.00"
                className="w-24 shrink-0 px-2 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon"
              />
              <button type="button" onClick={() => setFeeLines((prev) => prev.filter((_, i) => i !== idx))} className="p-2 rounded-full hover:bg-surface text-placeholder">
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setFeeLines((prev) => [...prev, { description: "", amount: "" }])} className="flex items-center gap-1.5 text-sm text-secondary font-medium hover:underline">
            <Plus size={14} /> Add fee line
          </button>
          <div className="flex flex-col items-end gap-0.5 pt-2 border-t border-line mt-2 text-sm">
            <div className="text-placeholder">Subtotal: ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="text-placeholder">GST (10%): ${gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="font-bold text-primary">Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </Section>

      {state?.error && <div className="text-sm text-error mb-4">{state.error}</div>}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
        {pending ? "Creating…" : "Create quote"}
      </button>
    </form>
  );
}
