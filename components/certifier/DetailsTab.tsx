"use client";

import { updateJobDetails, addCondition, assignJobClient } from "@/lib/actions/jobs";
import { BCA_VERSIONS, BUILDING_CLASSIFICATIONS, CONSTRUCTION_TYPES } from "@/lib/constants";
import { formatISODate } from "@/lib/business";
import type { Job, ConditionOfConsent, ClientContact } from "@/types/db";

const inputCls = "w-full px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

export function DetailsTab({ job, conditions, clients }: { job: Job; conditions: ConditionOfConsent[]; clients: ClientContact[] }) {
  const d = job.details || {};
  return (
    <div className="space-y-6">
      <form action={updateJobDetails} className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <input type="hidden" name="job_id" value={job.id} />
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

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Applicant name/company</label>
            <input name="contact_nameOrCompany" defaultValue={d.contact?.nameOrCompany || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Applicant mobile</label>
            <input name="contact_mobile" defaultValue={d.contact?.mobile || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Applicant email</label>
            <input name="contact_email" defaultValue={d.contact?.email || ""} className={inputCls} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Council / LGA</label>
            <input name="council_lga" defaultValue={d.council?.lga || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Construction type</label>
            <select name="constructionType" defaultValue={d.proposal?.constructionType || "N/A"} className={inputCls}>
              {CONSTRUCTION_TYPES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

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

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Estimated cost ($)</label>
            <input name="estimatedCost" defaultValue={d.proposal?.estimatedCost || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Storeys (total)</label>
            <input name="storeysTotal" defaultValue={d.proposal?.storeysTotal || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Site area (m²)</label>
            <input name="siteArea" defaultValue={d.siteArea || ""} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Building description</label>
          <textarea name="buildingDescription" defaultValue={d.buildingDescription || ""} rows={2} className={inputCls} />
        </div>

        <div className="border-t border-slate-100 pt-4 grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Lot/Section/DP</label>
            <input name="lotSectionDp" defaultValue={d.certificateDetails?.lotSectionDp || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>NSW Planning Portal ref</label>
            <input name="planningPortalRef" defaultValue={d.certificateDetails?.planningPortalRef || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Relevant instrument (EPI)</label>
            <input name="relevantInstrument" defaultValue={d.certificateDetails?.relevantInstrument || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Relevant part of code</label>
            <input name="relevantPartOfCode" defaultValue={d.certificateDetails?.relevantPartOfCode || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Determination date</label>
            <input type="date" name="determinationDate" defaultValue={d.certificateDetails?.determinationDate || ""} className={inputCls} />
          </div>
        </div>

        <button className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">Save details</button>
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
