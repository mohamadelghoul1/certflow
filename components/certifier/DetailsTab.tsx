"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateJobDetails, addCondition, assignJobClient, updateCouncilLetter, updateApplicantLetter, toggleCriticalStageInspection } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";
import {
  BCA_VERSIONS,
  BUILDING_CLASSIFICATIONS,
  CONSTRUCTION_TYPES,
  MANDATORY_CRITICAL_STAGE_INSPECTIONS,
  NSW_STATE,
  SEPP_CODE_PARTS,
  COUNCIL_DIRECTORY,
  epiForCodeParts,
} from "@/lib/constants";
import { formatISODate } from "@/lib/business";
import type { Job, ConditionOfConsent, ClientContact } from "@/types/db";

const inputCls = "w-full px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0 space-y-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </div>
  );
}

type CouncilState = {
  lga: string;
  streetNumber: string;
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  phone: string;
  fax: string;
  email: string;
};

export function DetailsTab({ job, conditions, clients }: { job: Job; conditions: ConditionOfConsent[]; clients: ClientContact[] }) {
  const d = job.details || {};
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateJobDetails, undefined);
  const [showSaved, setShowSaved] = useState(false);
  const wasPending = useRef(false);

  const [council, setCouncil] = useState<CouncilState>({
    lga: d.council?.lga || "",
    streetNumber: d.council?.address?.streetNumber || "",
    street: d.council?.address?.street || "",
    suburb: d.council?.address?.suburb || "",
    state: d.council?.address?.state || "NSW",
    postcode: d.council?.address?.postcode || "",
    phone: d.council?.contact?.phone || "",
    fax: d.council?.contact?.fax || "",
    email: d.council?.contact?.email || "",
  });
  const [codeParts, setCodeParts] = useState<Set<string>>(new Set(d.certificateDetails?.codeParts || []));

  function selectCouncil(name: string) {
    const match = COUNCIL_DIRECTORY.find((c) => c.name === name);
    if (match) {
      setCouncil({
        lga: match.name,
        streetNumber: match.address.streetNumber,
        street: match.address.street,
        suburb: match.address.suburb,
        state: match.address.state,
        postcode: match.address.postcode,
        phone: match.phone,
        fax: match.fax,
        email: match.email,
      });
    } else {
      setCouncil((prev) => ({ ...prev, lga: name }));
    }
  }

  function toggleCodePart(part: string) {
    setCodeParts((prev) => {
      const next = new Set(prev);
      next.has(part) ? next.delete(part) : next.add(part);
      return next;
    });
  }
  const codePartsArr = [...codeParts];

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2500);
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <div className="space-y-6">
      <form action={formAction} className="bg-white rounded-lg border border-slate-200 p-5">
        <input type="hidden" name="job_id" value={job.id} />
        <input type="hidden" name="pathway" value={job.pathway} />

        <Section title="Project configuration">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Project number</label>
              <input name="projectNumber" defaultValue={d.projectNumber || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Zoning</label>
              <input name="zoning" defaultValue={d.zoning || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>BCA / NCC version</label>
              <select name="bcaVersion" defaultValue={d.bcaVersion || ""} className={inputCls}>
                <option value="">—</option>
                {BCA_VERSIONS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <Section title="Company / primary contact">
          <div>
            <label className={labelCls}>Name or company name</label>
            <input name="contact_nameOrCompany" defaultValue={d.contact?.nameOrCompany || ""} className={inputCls} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Title</label>
              <input name="contact_title" defaultValue={d.contact?.title || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Given name(s)</label>
              <input name="contact_givenNames" defaultValue={d.contact?.givenNames || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Surname</label>
              <input name="contact_surname" defaultValue={d.contact?.surname || ""} className={inputCls} />
            </div>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Phone</label>
              <input name="contact_phone" defaultValue={d.contact?.phone || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fax</label>
              <input name="contact_fax" defaultValue={d.contact?.fax || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mobile</label>
              <input name="contact_mobile" defaultValue={d.contact?.mobile || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input name="contact_email" defaultValue={d.contact?.email || ""} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Applicant address</label>
            <div className="grid sm:grid-cols-5 gap-2">
              <input name="applicantAddress_streetNumber" defaultValue={d.applicantAddress?.streetNumber || ""} placeholder="No." className={inputCls} />
              <input name="applicantAddress_street" defaultValue={d.applicantAddress?.street || ""} placeholder="Street" className={`${inputCls} sm:col-span-2`} />
              <input name="applicantAddress_suburb" defaultValue={d.applicantAddress?.suburb || ""} placeholder="Suburb" className={inputCls} />
              <input name="applicantAddress_postcode" defaultValue={d.applicantAddress?.postcode || ""} placeholder="Postcode" className={inputCls} />
            </div>
            <select name="applicantAddress_state" defaultValue={d.applicantAddress?.state || "NSW"} className={`${inputCls} mt-2 sm:w-40`}>
              {NSW_STATE.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="Owner details">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="ownerSameAsApplicant" defaultChecked={d.ownerSameAsApplicant !== false} className="accent-teal-700" />
            Use the applicant&apos;s details as the owner
          </label>
          <div>
            <label className={labelCls}>Owner name (if different)</label>
            <input name="owner_name" defaultValue={d.owner?.name || ""} placeholder="e.g. Jane Smith & John Smith" className={inputCls} />
          </div>
          <div className="grid sm:grid-cols-5 gap-2">
            <input name="owner_streetNumber" defaultValue={d.owner?.address?.streetNumber || ""} placeholder="No." className={inputCls} />
            <input name="owner_street" defaultValue={d.owner?.address?.street || ""} placeholder="Street" className={`${inputCls} sm:col-span-2`} />
            <input name="owner_suburb" defaultValue={d.owner?.address?.suburb || ""} placeholder="Suburb" className={inputCls} />
            <input name="owner_postcode" defaultValue={d.owner?.address?.postcode || ""} placeholder="Postcode" className={inputCls} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <select name="owner_state" defaultValue={d.owner?.address?.state || "NSW"} className={inputCls}>
              {NSW_STATE.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input name="owner_phone" defaultValue={d.owner?.phone || ""} placeholder="Owner phone" className={inputCls} />
          </div>
        </Section>

        <Section title={`${job.pathway} certificate details`}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Lot/Section/DP</label>
              <input name="lotSectionDp" defaultValue={d.certificateDetails?.lotSectionDp || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>NSW Planning Portal ref</label>
              <input name="planningPortalRef" defaultValue={d.certificateDetails?.planningPortalRef || ""} className={inputCls} />
            </div>
          </div>
          {job.pathway === "CDC" ? (
            <div>
              <label className={labelCls}>Relevant part of code — tick every part of SEPP 2008 this CDC relies on</label>
              <div className="flex flex-wrap gap-2">
                {SEPP_CODE_PARTS.map((part) => {
                  const active = codeParts.has(part);
                  return (
                    <button
                      type="button"
                      key={part}
                      onClick={() => toggleCodePart(part)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active ? "bg-teal-800 text-white border-teal-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      {part}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-slate-400 mt-2">{codePartsArr.length === 0 ? "Nothing selected yet." : `Certificate will show: ${epiForCodeParts(codePartsArr)}`}</div>
              {codePartsArr.map((p) => (
                <input key={p} type="hidden" name="codeParts" value={p} />
              ))}
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Relevant instrument (EPI)</label>
                <textarea name="relevantInstrument" defaultValue={d.certificateDetails?.relevantInstrument || ""} rows={2} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Relevant part of code</label>
                <input name="relevantPartOfCode" defaultValue={d.certificateDetails?.relevantPartOfCode || ""} className={inputCls} />
              </div>
            </>
          )}
          <div>
            <label className={labelCls}>Determination date</label>
            <input type="date" name="determinationDate" defaultValue={d.certificateDetails?.determinationDate || ""} className={inputCls} />
          </div>
        </Section>

        <Section title="Council">
          <div>
            <label className={labelCls}>Local Government Area — type to search, selecting one fills in the rest automatically</label>
            <input list="council-directory-list-edit" value={council.lga} onChange={(e) => selectCouncil(e.target.value)} placeholder="e.g. Fairfield City Council" className={inputCls} />
            <datalist id="council-directory-list-edit">
              {COUNCIL_DIRECTORY.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
            <input type="hidden" name="council_lga" value={council.lga} />
          </div>
          <div className="grid sm:grid-cols-5 gap-2">
            <input value={council.streetNumber} onChange={(e) => setCouncil((p) => ({ ...p, streetNumber: e.target.value }))} placeholder="No." className={inputCls} />
            <input value={council.street} onChange={(e) => setCouncil((p) => ({ ...p, street: e.target.value }))} placeholder="Street" className={`${inputCls} sm:col-span-2`} />
            <input value={council.suburb} onChange={(e) => setCouncil((p) => ({ ...p, suburb: e.target.value }))} placeholder="Suburb" className={inputCls} />
            <input value={council.postcode} onChange={(e) => setCouncil((p) => ({ ...p, postcode: e.target.value }))} placeholder="Postcode" className={inputCls} />
          </div>
          <select value={council.state} onChange={(e) => setCouncil((p) => ({ ...p, state: e.target.value }))} className={`${inputCls} sm:w-40`}>
            {NSW_STATE.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div className="grid sm:grid-cols-3 gap-4">
            <input value={council.phone} onChange={(e) => setCouncil((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className={inputCls} />
            <input value={council.fax} onChange={(e) => setCouncil((p) => ({ ...p, fax: e.target.value }))} placeholder="Fax" className={inputCls} />
            <input value={council.email} onChange={(e) => setCouncil((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className={inputCls} />
          </div>
          <input type="hidden" name="council_streetNumber" value={council.streetNumber} />
          <input type="hidden" name="council_street" value={council.street} />
          <input type="hidden" name="council_suburb" value={council.suburb} />
          <input type="hidden" name="council_state" value={council.state} />
          <input type="hidden" name="council_postcode" value={council.postcode} />
          <input type="hidden" name="council_phone" value={council.phone} />
          <input type="hidden" name="council_fax" value={council.fax} />
          <input type="hidden" name="council_email" value={council.email} />
        </Section>

        <Section title="Proposal details">
          <div>
            <label className={labelCls}>Building classification(s)</label>
            <div className="flex flex-wrap gap-3">
              {BUILDING_CLASSIFICATIONS.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" name="classifications" value={c} defaultChecked={d.proposal?.classifications?.includes(c)} className="accent-teal-700" />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Construction type</label>
            <select name="constructionType" defaultValue={d.proposal?.constructionType || "N/A"} className={inputCls}>
              {CONSTRUCTION_TYPES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Dwellings — existing</label>
              <input type="number" name="dwellingsExisting" defaultValue={d.proposal?.dwellingsExisting || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Dwellings — demolished</label>
              <input type="number" name="dwellingsDemolished" defaultValue={d.proposal?.dwellingsDemolished || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Dwellings — new</label>
              <input type="number" name="dwellingsNew" defaultValue={d.proposal?.dwellingsNew || ""} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Estimated cost ($)</label>
            <input type="number" name="estimatedCost" defaultValue={d.proposal?.estimatedCost || ""} className={inputCls} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Storeys — above ground</label>
              <input type="number" name="storeysAbove" defaultValue={d.proposal?.storeysAbove || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Storeys — below ground</label>
              <input type="number" name="storeysBelow" defaultValue={d.proposal?.storeysBelow || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Storeys — total</label>
              <input type="number" name="storeysTotal" defaultValue={d.proposal?.storeysTotal || ""} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Effective height (m)</label>
            <input type="number" name="effectiveHeight" defaultValue={d.proposal?.effectiveHeight || ""} className={inputCls} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Existing floor area (m²)</label>
              <input type="number" name="floorAreaExisting" defaultValue={d.proposal?.floorAreaExisting || ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>New floor area (m²)</label>
              <input type="number" name="floorAreaNew" defaultValue={d.proposal?.floorAreaNew || ""} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Site area (m²)</label>
            <input type="number" name="siteArea" defaultValue={d.siteArea || ""} className={inputCls} />
          </div>
        </Section>

        <Section title="Building description">
          <textarea name="buildingDescription" defaultValue={d.buildingDescription || ""} rows={2} className={inputCls} />
        </Section>

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
          <button disabled={pending} className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-60">
            {pending ? "Saving…" : "Save details"}
          </button>
          {showSaved && <span className="text-sm font-medium text-emerald-700">Saved ✓</span>}
          {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="font-bold text-teal-900 mb-3">Client portal access</div>
        <form action={assignJobClient} className="flex items-center gap-2">
          <input type="hidden" name="job_id" value={job.id} />
          <select name="client_id" defaultValue={job.client_id || ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={inputCls}>
            <option value="">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </form>
        <p className="text-xs text-slate-400 mt-2">Add clients under Settings, then assign one here to give them portal access to this job.</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="font-bold text-teal-900 mb-1">Critical stage inspections</div>
        <p className="text-xs text-slate-400 mb-3">Which of the mandatory critical stage inspections apply to this job — shown on the Mandatory Inspections Notice in the certificate package.</p>
        <div className="space-y-2">
          {MANDATORY_CRITICAL_STAGE_INSPECTIONS.map((insp) => (
            <form action={toggleCriticalStageInspection} key={insp.no}>
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="no" value={insp.no} />
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  defaultChecked={job.critical_stage_inspections.includes(insp.no)}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  className="mt-0.5 accent-teal-700"
                />
                <span>
                  {insp.no}. {insp.stage} <span className="text-slate-400">({insp.inspector})</span>
                </span>
              </label>
            </form>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="font-bold text-teal-900 mb-1">Certificate package letters</div>
        <p className="text-xs text-slate-400 mb-3">
          The council and applicant letters in the certificate package use a standard template automatically. Leave blank to keep that, or write your own text
          here to override it for this job.
        </p>
        <LetterOverrideForm action={updateCouncilLetter} jobId={job.id} label="Council letter override" defaultValue={job.council_letter_override || ""} />
        <div className="h-4" />
        <LetterOverrideForm action={updateApplicantLetter} jobId={job.id} label="Applicant letter override" defaultValue={job.applicant_letter_override || ""} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="font-bold text-teal-900 mb-3">Conditions of Consent</div>
        <div className="space-y-2 mb-3">
          {conditions.map((c) => (
            <div key={c.id} className="text-sm text-slate-700 border-b border-slate-50 pb-2">
              {c.text}
              <div className="text-[11px] text-slate-400">{formatISODate(c.date_added)}</div>
            </div>
          ))}
          {conditions.length === 0 && <div className="text-sm text-slate-400">None added.</div>}
        </div>
        <form action={addCondition} className="flex gap-2">
          <input type="hidden" name="job_id" value={job.id} />
          <input name="text" placeholder="Add a condition of consent…" className={inputCls} />
          <button className="px-3 py-2 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900 shrink-0">Add</button>
        </form>
      </div>
    </div>
  );
}

function LetterOverrideForm({ action, jobId, label, defaultValue }: { action: (formData: FormData) => Promise<void>; jobId: string; label: string; defaultValue: string }) {
  const [pending, setPending] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await action(new FormData(e.currentTarget));
    setPending(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2500);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="job_id" value={jobId} />
      <label className={labelCls}>{label}</label>
      <textarea name="text" defaultValue={defaultValue} rows={4} placeholder="Leave blank for the standard letter text…" className={inputCls} />
      <div className="flex items-center gap-3 mt-2">
        <button disabled={pending} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900 disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        {showSaved && <span className="text-xs font-medium text-emerald-700">Saved ✓</span>}
      </div>
    </form>
  );
}
