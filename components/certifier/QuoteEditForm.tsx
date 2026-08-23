"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateQuote } from "@/lib/actions/quotes";
import type { ActionState } from "@/lib/actions/auth";
import { NSW_STATE, JOB_TYPES, BUILDING_CLASSIFICATIONS, VALID_FOR_OPTIONS } from "@/lib/constants";
import { AddressLookupField } from "@/components/certifier/AddressLookupField";
import { ApplicantAddressField } from "@/components/certifier/ApplicantAddressField";
import type { Quote, QuoteFeeLine } from "@/types/db";
import { X, Plus } from "lucide-react";
import { DateField, todayISO } from "@/components/DateField";

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
  const [lotSectionPlan, setLotSectionPlan] = useState(quote.lot_section_plan || "");
  const [councilLga, setCouncilLga] = useState(quote.council_lga || "");
  const [ownerIsApplicant, setOwnerIsApplicant] = useState(quote.owner_is_applicant);
  const [scopeItems, setScopeItems] = useState<string[]>(quote.scope_of_works && quote.scope_of_works.length > 0 ? quote.scope_of_works : [""]);
  const [validFor, setValidFor] = useState(quote.valid_for || "7 Days");
  const [feeLines, setFeeLines] = useState<FeeLine[]>(
    initialFeeLines.length > 0
      ? initialFeeLines.map((l) => ({ description: l.description, amount: String(l.amount) }))
      : [{ description: `${quote.pathway}/PC/OC`, amount: "2500" }]
  );

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2500);
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending, state]);

  const subtotal = feeLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
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
            {/* Backed by the standard list but free to type over — same as
                the New Quote form. */}
            <input name="project_type" list="quote-project-types" defaultValue={quote.project_type || ""} placeholder="Pick from the list or type your own" autoComplete="off" className={inputCls} />
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
            {/* Start can't be in the future, end can't be in the past —
                but a saved date already outside the bound stays pickable,
                so an old quote can still be re-saved untouched. */}
            <DateField
              name="required_start_date"
              defaultValue={quote.required_start_date || ""}
              max={quote.required_start_date && quote.required_start_date > todayISO() ? quote.required_start_date : todayISO()}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Required end date</label>
            <DateField
              name="required_end_date"
              defaultValue={quote.required_end_date || ""}
              min={quote.required_end_date && quote.required_end_date < todayISO() ? quote.required_end_date : todayISO()}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Quote valid for</label>
          {/* Either one of the usual periods, or a date of the certifier's
              own choosing — stored as "Until yyyy-mm-dd" so the quote
              document can say "valid until" that day. */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={validFor.startsWith("Until ") ? "Until a specific date" : validFor}
              onChange={(e) => setValidFor(e.target.value === "Until a specific date" ? `Until ${todayISO()}` : e.target.value)}
              className={`${inputCls} sm:w-56`}
            >
              {VALID_FOR_OPTIONS.map((v) => (
                <option key={v}>{v}</option>
              ))}
              <option>Until a specific date</option>
            </select>
            {validFor.startsWith("Until ") && (
              <DateField value={validFor.slice(6)} onChange={(e) => setValidFor(`Until ${e.target.value}`)} className={`${inputCls} sm:w-48`} />
            )}
          </div>
          <input type="hidden" name="valid_for" value={validFor} />
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
          <label className={labelCls}>Job description</label>
          <textarea name="development_description" defaultValue={quote.development_description || ""} rows={2} placeholder="e.g. Construction of a new two-storey dwelling" className={inputCls} />
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
        <ApplicantAddressField defaults={applicant.address} />
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
    </form>
  );
}
