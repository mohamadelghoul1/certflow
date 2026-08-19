"use client";

import { useActionState, useState } from "react";
import { createQuote } from "@/lib/actions/quotes";
import type { ActionState } from "@/lib/actions/auth";
import { NSW_STATE, JOB_TYPES, BUILDING_CLASSIFICATIONS, VALID_FOR_OPTIONS, matchCouncilByAddress, defaultScopeOfWorks } from "@/lib/constants";
import { X, Plus } from "lucide-react";

const inputCls = "w-full px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 mb-5">
      <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">{title}</div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

type FeeLine = { description: string; quantity: string; amount: string };

export function NewQuoteForm({ certifiers, clients }: { certifiers: { id: string; name: string }[]; clients: { id: string; name: string; type: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createQuote, undefined);
  const [pathway, setPathway] = useState<"CDC" | "CC">("CDC");
  const [proposalAddress, setProposalAddress] = useState("");
  const [councilLga, setCouncilLga] = useState("");
  const [ownerIsApplicant, setOwnerIsApplicant] = useState(true);
  const [scopeItems, setScopeItems] = useState<string[]>(defaultScopeOfWorks("CDC"));
  const [feeLines, setFeeLines] = useState<FeeLine[]>([{ description: "CDC/PC/OC", quantity: "1", amount: "2500" }]);

  function handleAddressChange(v: string) {
    setProposalAddress(v);
    if (!councilLga) {
      const match = matchCouncilByAddress(v);
      if (match) setCouncilLga(match.name);
    }
  }

  function handlePathwayChange(p: "CDC" | "CC") {
    setPathway(p);
    setFeeLines((prev) => (prev.length === 1 && prev[0].description === `${pathway}/PC/OC` ? [{ ...prev[0], description: `${p}/PC/OC` }] : prev));
  }

  const subtotal = feeLines.reduce((sum, l) => sum + (Number(l.amount) || 0) * (Number(l.quantity) || 1), 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  return (
    <form action={formAction}>
      <Section title="Quote details">
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
            <select name="project_type" defaultValue="" className={inputCls}>
              <option value="">None</option>
              {JOB_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Pathway — used if this quote converts into a job</label>
          <div className="flex gap-2">
            {(["CDC", "CC"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePathwayChange(p)}
                className={`flex-1 py-2 rounded-md text-sm font-semibold border ${pathway === p ? "bg-teal-800 text-white border-teal-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
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
            <input type="date" name="required_start_date" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Required end date</label>
            <input type="date" name="required_end_date" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Quote valid for</label>
          <select name="valid_for" defaultValue="7 Days" className={inputCls}>
            {VALID_FOR_OPTIONS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Proposal">
        <div>
          <label className={labelCls}>Proposal address</label>
          <input name="proposal_address" required value={proposalAddress} onChange={(e) => handleAddressChange(e.target.value)} placeholder="Start typing an address" className={inputCls} />
          {councilLga && <div className="text-[11px] text-teal-700 mt-1">Council: {councilLga} — auto-matched, edit below if wrong.</div>}
        </div>
        <div>
          <label className={labelCls}>Lot/Section/Plan</label>
          <input name="lot_section_plan" placeholder="e.g. 12/-/DP12345" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Project title</label>
          <input name="project_title" placeholder="e.g. Smith Residence — 99 Aviary Road, Sydney" className={inputCls} />
        </div>
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
              <label key={c} className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" name="classifications" value={c} className="accent-teal-700" />
                {c}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Development description</label>
          <textarea name="development_description" rows={2} placeholder="e.g. New dwelling, house" className={inputCls} />
        </div>
      </Section>

      <Section title="Contact details">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="owner_is_applicant" checked={ownerIsApplicant} onChange={(e) => setOwnerIsApplicant(e.target.checked)} className="accent-teal-700" />
          Owner is the applicant
        </label>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Applicant name</label>
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
        <div>
          <label className={labelCls}>Applicant address</label>
          <div className="grid sm:grid-cols-5 gap-2">
            <input name="applicant_streetNumber" placeholder="No." className={inputCls} />
            <input name="applicant_street" placeholder="Street" className={`${inputCls} sm:col-span-2`} />
            <input name="applicant_suburb" placeholder="Suburb" className={inputCls} />
            <input name="applicant_postcode" placeholder="Postcode" className={inputCls} />
          </div>
          <select name="applicant_state" defaultValue="NSW" className={`${inputCls} mt-2 sm:w-40`}>
            {NSW_STATE.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Client — link this quote to a client so it can flow through to the job automatically</label>
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
          <div className="grid sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
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
              <button type="button" onClick={() => setScopeItems((prev) => prev.filter((_, i) => i !== idx))} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setScopeItems((prev) => [...prev, ""])} className="flex items-center gap-1.5 text-sm text-teal-700 font-medium hover:underline">
            <Plus size={14} /> Add scope item
          </button>
        </div>
      </Section>

      <Section title="Fee">
        <div className="space-y-2">
          <div className="flex gap-2 items-center text-xs text-slate-400 px-1">
            <span className="flex-1">Description</span>
            <span className="w-16 text-center">Qty</span>
            <span className="w-32 text-right pr-8">Unit price</span>
          </div>
          {feeLines.map((line, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                name="fee_description"
                value={line.description}
                onChange={(e) => setFeeLines((prev) => prev.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l)))}
                placeholder="e.g. CDC/PC/OC"
                className={`${inputCls} flex-1`}
              />
              <input
                type="number"
                name="fee_quantity"
                value={line.quantity}
                onChange={(e) => setFeeLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))}
                placeholder="1"
                className={`${inputCls} w-16 text-center`}
              />
              <input
                type="number"
                name="fee_amount"
                value={line.amount}
                onChange={(e) => setFeeLines((prev) => prev.map((l, i) => (i === idx ? { ...l, amount: e.target.value } : l)))}
                placeholder="0.00"
                className={`${inputCls} w-32`}
              />
              <button type="button" onClick={() => setFeeLines((prev) => prev.filter((_, i) => i !== idx))} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setFeeLines((prev) => [...prev, { description: "", quantity: "1", amount: "" }])} className="flex items-center gap-1.5 text-sm text-teal-700 font-medium hover:underline">
            <Plus size={14} /> Add fee line
          </button>
          <div className="flex flex-col items-end gap-0.5 pt-2 border-t border-slate-100 mt-2 text-sm">
            <div className="text-slate-500">Subtotal: ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="text-slate-500">GST (10%): ${gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="font-bold text-teal-900">Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </Section>

      {state?.error && <div className="text-sm text-red-600 mb-4">{state.error}</div>}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Creating…" : "Create quote"}
      </button>
    </form>
  );
}
