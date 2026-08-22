"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateQuote } from "@/lib/actions/quotes";
import type { ActionState } from "@/lib/actions/auth";
import { NSW_STATE, JOB_TYPES, BUILDING_CLASSIFICATIONS, VALID_FOR_OPTIONS, matchCouncilByAddress } from "@/lib/constants";
import type { Quote, QuoteFeeLine } from "@/types/db";
import { X, Plus } from "lucide-react";

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

type FeeLine = { description: string; quantity: string; amount: string };

export function QuoteEditForm({
  quote,
  feeLines: initialFeeLines,
  certifiers,
  clients,
}: {
  quote: Quote;
  feeLines: QuoteFeeLine[];
  certifiers: { id: string; name: string }[];
  clients: { id: string; name: string; type: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateQuote, undefined);
  const [showSaved, setShowSaved] = useState(false);
  const wasPending = useRef(false);

  const applicant = (quote.applicant || {}) as { name?: string; email?: string; phone?: string; address?: Record<string, string> };
  const owner = (quote.owner || {}) as { name?: string; phone?: string; email?: string };

  const [pathway, setPathway] = useState<"CDC" | "CC">(quote.pathway);
  const [proposalAddress, setProposalAddress] = useState(quote.proposal_address || "");
  const [councilLga, setCouncilLga] = useState(quote.council_lga || "");
  const [ownerIsApplicant, setOwnerIsApplicant] = useState(quote.owner_is_applicant);
  const [scopeItems, setScopeItems] = useState<string[]>(quote.scope_of_works && quote.scope_of_works.length > 0 ? quote.scope_of_works : [""]);
  const [feeLines, setFeeLines] = useState<FeeLine[]>(
    initialFeeLines.length > 0
      ? initialFeeLines.map((l) => ({ description: l.description, quantity: l.quantity || "1", amount: String(l.amount) }))
      : [{ description: `${quote.pathway}/PC/OC`, quantity: "1", amount: "2500" }]
  );

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2500);
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending, state]);

  function handleAddressChange(v: string) {
    setProposalAddress(v);
    if (!councilLga) {
      const match = matchCouncilByAddress(v);
      if (match) setCouncilLga(match.name);
    }
  }

  const subtotal = feeLines.reduce((sum, l) => sum + (Number(l.amount) || 0) * (Number(l.quantity) || 1), 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  return (
    <form action={formAction}>
      <input type="hidden" name="quote_id" value={quote.id} />
      <input type="hidden" name="pathway" value={pathway} />

      <div className="flex items-center justify-end gap-2 mb-6">
        {showSaved && <span className="text-sm font-medium text-success">Saved ✓</span>}
        <button className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>

      <Section title="Quote details">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>State</label>
            <select name="state" defaultValue={quote.state || "NSW"} className={inputCls}>
              {NSW_STATE.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Project type</label>
            <select name="project_type" defaultValue={quote.project_type || ""} className={inputCls}>
              <option value="">None</option>
              {JOB_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Pathway — used if this quote converts into a project</label>
          <div className="flex gap-2">
            {(["CDC", "CC"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPathway(p)}
                className={`flex-1 py-2 rounded-md text-sm font-semibold border ${pathway === p ? "bg-primary text-white border-primary" : "border-line text-muted hover:bg-hover"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Required start date</label>
            <input type="date" name="required_start_date" defaultValue={quote.required_start_date || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Required end date</label>
            <input type="date" name="required_end_date" defaultValue={quote.required_end_date || ""} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Quote valid for</label>
          <select name="valid_for" defaultValue={quote.valid_for || "7 Days"} className={inputCls}>
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
          {councilLga && <div className="text-[11px] text-secondary mt-1">Council: {councilLga} — auto-matched, edit below if wrong.</div>}
        </div>
        <div>
          <label className={labelCls}>Lot/Section/Plan</label>
          <input name="lot_section_plan" defaultValue={quote.lot_section_plan || ""} placeholder="e.g. 12/-/DP12345" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Project title</label>
          <input name="project_title" defaultValue={quote.project_title || ""} placeholder="e.g. Smith Residence — 99 Aviary Road, Sydney" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Certifier</label>
          <select name="certifier_id" className={inputCls} defaultValue={quote.certifier_id || ""}>
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
                <input type="checkbox" name="classifications" value={c} defaultChecked={(quote.classifications || []).includes(c)} className="accent-icon" />
                {c}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Development description</label>
          <textarea name="development_description" defaultValue={quote.development_description || ""} rows={2} placeholder="e.g. New dwelling, house" className={inputCls} />
        </div>
      </Section>

      <Section title="Contact details">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="owner_is_applicant" checked={ownerIsApplicant} onChange={(e) => setOwnerIsApplicant(e.target.checked)} className="accent-icon" />
          Owner is the applicant
        </label>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Applicant name</label>
            <input name="applicant_name" defaultValue={applicant.name || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Applicant phone</label>
            <input name="applicant_phone" defaultValue={applicant.phone || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Applicant email</label>
            <input type="email" name="applicant_email" defaultValue={applicant.email || ""} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Applicant address</label>
          <div className="grid sm:grid-cols-5 gap-2">
            <input name="applicant_streetNumber" defaultValue={applicant.address?.streetNumber || ""} placeholder="No." className={inputCls} />
            <input name="applicant_street" defaultValue={applicant.address?.street || ""} placeholder="Street" className={`${inputCls} sm:col-span-2`} />
            <input name="applicant_suburb" defaultValue={applicant.address?.suburb || ""} placeholder="Suburb" className={inputCls} />
            <input name="applicant_postcode" defaultValue={applicant.address?.postcode || ""} placeholder="Postcode" className={inputCls} />
          </div>
          <select name="applicant_state" defaultValue={applicant.address?.state || "NSW"} className={`${inputCls} mt-2 sm:w-40`}>
            {NSW_STATE.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Client — link this quote to a client so it can flow through to the project automatically</label>
          <select name="client_id" className={inputCls} defaultValue={quote.client_id || ""}>
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
              <input name="owner_name" defaultValue={owner.name || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Owner phone</label>
              <input name="owner_phone" defaultValue={owner.phone || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Owner email</label>
              <input type="email" name="owner_email" defaultValue={owner.email || ""} className={inputCls} />
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
              <button type="button" onClick={() => setFeeLines((prev) => prev.filter((_, i) => i !== idx))} className="p-2 rounded-full hover:bg-surface text-placeholder">
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setFeeLines((prev) => [...prev, { description: "", quantity: "1", amount: "" }])} className="flex items-center gap-1.5 text-sm text-secondary font-medium hover:underline">
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
    </form>
  );
}
