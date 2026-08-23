"use client";

import { useActionState, useState } from "react";
import { createJob } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";
import {
  JOB_TYPES,
  BCA_VERSIONS,
  BCA_VOLUMES,
  BUILDING_CLASSIFICATIONS,
  CONSTRUCTION_TYPES,
  NSW_STATE,
  SEPP_CODE_PARTS,
  COUNCIL_DIRECTORY,
  epiForCodeParts,
} from "@/lib/constants";
import { X, AlertTriangle } from "lucide-react";
import { AddressLookupField } from "@/components/certifier/AddressLookupField";
import { DateField } from "@/components/DateField";
import { portalRefPlaceholder, portalRefKindFor, pathwayServiceLabel, type Pathway } from "@/lib/business";
import { PriorApprovalFields } from "@/components/certifier/PriorApprovalFields";

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-xs font-semibold text-placeholder mb-1";

type CouncilState = {
  lga: string;
  streetNumber: string;
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  phone: string;
  email: string;
};
const emptyCouncil: CouncilState = { lga: "", streetNumber: "", street: "", suburb: "", state: "NSW", postcode: "", phone: "", email: "" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-line mb-5">
      <div className="px-5 py-3 border-b border-line font-bold text-primary">{title}</div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export function NewJobForm({ certifiers, clients }: { certifiers: { id: string; name: string }[]; clients: { id: string; name: string; type: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createJob, undefined);
  const [types, setTypes] = useState<string[]>([]);
  const [customType, setCustomType] = useState("");
  const [pathway, setPathway] = useState<Pathway>("CDC");
  const [address, setAddress] = useState("");
  const [lotSectionDp, setLotSectionDp] = useState("");
  const [zoning, setZoning] = useState("");
  const [council, setCouncil] = useState<CouncilState>(emptyCouncil);
  const [codeParts, setCodeParts] = useState<Set<string>>(new Set());

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

  return (
    <form action={formAction}>
      <div className="bg-hover border border-line rounded-md px-4 py-3 mb-5 text-sm text-primary">
        This information is captured once and stays attached to the project — you can come back and edit it later from the Details tab.
      </div>

      <Section title="Project basics">
        <AddressLookupField
          address={address}
          onAddressChange={setAddress}
          lotSectionDp={lotSectionDp}
          onLotSectionDpChange={setLotSectionDp}
          onCouncilMatched={selectCouncil}
          councilLga={council.lga}
          zoning={zoning}
          onZoningChange={setZoning}
          required
          zoningRequired={pathway === "CDC"}
        />
        <div>
          <label className={labelCls}>Scope of works</label>
          <textarea name="description" rows={2} required placeholder="e.g. Construction of a secondary dwelling" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Project type(s)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {JOB_TYPES.map((t) => {
              const active = types.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypes((prev) => (active ? prev.filter((v) => v !== t) : [...prev, t]))}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium ${active ? "bg-primary text-white border-primary" : "border-line text-muted hover:bg-hover"}`}
                >
                  {t}
                </button>
              );
            })}
            {types
              .filter((t) => !JOB_TYPES.includes(t))
              .map((t) => (
                <span key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-hover text-primary border border-line">
                  {t}
                  <button type="button" onClick={() => setTypes((prev) => prev.filter((v) => v !== t))} className="hover:text-primary">
                    <X size={11} />
                  </button>
                </span>
              ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const text = customType.trim();
                if (text && !types.includes(text)) setTypes((prev) => [...prev, text]);
                setCustomType("");
              }}
              placeholder="Type your own and press Enter to add"
              className="flex-1 px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon"
            />
            <button
              type="button"
              onClick={() => {
                const text = customType.trim();
                if (text && !types.includes(text)) setTypes((prev) => [...prev, text]);
                setCustomType("");
              }}
              className="px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary-700"
            >
              Add
            </button>
          </div>
          {types.map((t) => (
            <input key={t} type="hidden" name="job_types" value={t} />
          ))}
        </div>
        <div>
          <label className={labelCls}>Service</label>
          {/* The third is for a client who already holds a CDC or CC from
              another certifier and needs this firm only as Principal
              Certifier through to the Occupation Certificate. */}
          <div className="grid sm:grid-cols-3 gap-2">
            {(["CDC", "CC", "PC_OC"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPathway(p)}
                className={`py-2 px-2 rounded-md text-xs font-semibold border ${pathway === p ? "bg-primary text-white border-primary" : "border-line text-muted hover:bg-hover"}`}
              >
                {pathwayServiceLabel(p)}
              </button>
            ))}
          </div>
          <input type="hidden" name="pathway" value={pathway} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Assigned certifier</label>
            <select name="assigned_certifier_id" required className={inputCls} defaultValue="">
              <option value="">— Select —</option>
              {certifiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Client (portal access)</label>
            <select name="client_id" className={inputCls} defaultValue="">
              <option value="">— None yet —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Project configuration">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Project number</label>
            <input name="projectNumber" placeholder="Auto number" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>BCA / NCC version</label>
            <input name="bcaVersion" list="bca-version-list" required placeholder="e.g. NCC 2022" className={inputCls} />
            <datalist id="bca-version-list">
              {BCA_VERSIONS.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {BCA_VOLUMES.map((v) => (
                <label key={v} className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" name="bcaVolumes" value={v} className="accent-icon" />
                  {v}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Company / primary contact">
        <div>
          <label className={labelCls}>Name or company name</label>
          <input name="contact_nameOrCompany" className={inputCls} />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Title</label>
            <input name="contact_title" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Given name(s)</label>
            <input name="contact_givenNames" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Surname</label>
            <input name="contact_surname" className={inputCls} />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Phone</label>
            <input name="contact_phone" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mobile</label>
            <input name="contact_mobile" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" name="contact_email" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Applicant address</label>
          <div className="grid sm:grid-cols-5 gap-2">
            <input name="applicantAddress_streetNumber" required placeholder="No." className={inputCls} />
            <input name="applicantAddress_street" required placeholder="Street" className={`${inputCls} sm:col-span-2`} />
            <input name="applicantAddress_suburb" required placeholder="Suburb" className={inputCls} />
            <input name="applicantAddress_postcode" required placeholder="Postcode" className={inputCls} />
          </div>
          <select name="applicantAddress_state" defaultValue="NSW" className={`${inputCls} mt-2 sm:w-40`}>
            {NSW_STATE.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Owner details">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="ownerSameAsApplicant" defaultChecked className="accent-icon" />
          Use the applicant&apos;s details as the owner
        </label>
        <div>
          <label className={labelCls}>Owner name (if different)</label>
          <input name="owner_name" placeholder="e.g. Jane Smith & John Smith" className={inputCls} />
        </div>
        <div className="grid sm:grid-cols-5 gap-2">
          <input name="owner_streetNumber" placeholder="No." className={inputCls} />
          <input name="owner_street" placeholder="Street" className={`${inputCls} sm:col-span-2`} />
          <input name="owner_suburb" placeholder="Suburb" className={inputCls} />
          <input name="owner_postcode" placeholder="Postcode" className={inputCls} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <select name="owner_state" defaultValue="NSW" className={inputCls}>
            {NSW_STATE.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input name="owner_phone" placeholder="Owner phone" className={inputCls} />
        </div>
      </Section>

      <Section title={pathway === "PC_OC" ? "Previously issued approval" : `${pathway} certificate details`}>
        {pathway !== "PC_OC" && (
          <div>
            <label className={labelCls}>NSW Planning Portal ref number</label>
            <input name="planningPortalRef" placeholder={portalRefPlaceholder(portalRefKindFor(pathway))} className={inputCls} />
          </div>
        )}
        {pathway === "PC_OC" ? (
          <PriorApprovalFields />
        ) : pathway === "CDC" ? (
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
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active ? "bg-primary text-white border-primary" : "bg-white text-muted border-line hover:bg-hover"}`}
                  >
                    {part}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-placeholder mt-2">{codePartsArr.length === 0 ? "Nothing selected yet." : `Certificate will show: ${epiForCodeParts(codePartsArr)}`}</div>
            {codePartsArr.map((p) => (
              <input key={p} type="hidden" name="codeParts" value={p} />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Development Consent (DA) Number</label>
              <input name="developmentConsentNumber" placeholder="e.g. DA-25-01431" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Development Consent (DA) Date</label>
              <DateField name="developmentConsentDate" className={inputCls} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Council">
        <div>
          <label className={labelCls}>Local Government Area — type to search, selecting one fills in the rest automatically</label>
          <input list="council-directory-list" value={council.lga} onChange={(e) => selectCouncil(e.target.value)} placeholder="e.g. Fairfield City Council" className={inputCls} />
          <datalist id="council-directory-list">
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
        <div className="grid sm:grid-cols-2 gap-4">
          <input value={council.phone} onChange={(e) => setCouncil((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className={inputCls} />
          <input value={council.email} onChange={(e) => setCouncil((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className={inputCls} />
        </div>
        <input type="hidden" name="council_streetNumber" value={council.streetNumber} />
        <input type="hidden" name="council_street" value={council.street} />
        <input type="hidden" name="council_suburb" value={council.suburb} />
        <input type="hidden" name="council_state" value={council.state} />
        <input type="hidden" name="council_postcode" value={council.postcode} />
        <input type="hidden" name="council_phone" value={council.phone} />
        <input type="hidden" name="council_email" value={council.email} />
      </Section>

      <Section title="Proposal details">
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
          <label className={labelCls}>Construction type</label>
          <select name="constructionType" defaultValue="N/A" className={inputCls}>
            {CONSTRUCTION_TYPES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Dwellings — existing</label>
            <input type="number" name="dwellingsExisting" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Dwellings — demolished</label>
            <input type="number" name="dwellingsDemolished" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Dwellings — new</label>
            <input type="number" name="dwellingsNew" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Total estimated cost / value of project (AUD)</label>
          <input type="number" name="estimatedCost" required className={inputCls} />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Storeys — above ground</label>
            <input type="number" name="storeysAbove" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Storeys — below ground</label>
            <input type="number" name="storeysBelow" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Storeys — total</label>
            <input type="number" name="storeysTotal" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Effective height (m)</label>
          <input type="number" step="any" name="effectiveHeight" className={inputCls} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Existing floor area (m²)</label>
            <input type="text" inputMode="decimal" name="floorAreaExisting" placeholder="e.g. 123.4" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>New floor area (m²)</label>
            <input type="text" inputMode="decimal" name="floorAreaNew" placeholder="e.g. 123.4" className={inputCls} />
          </div>
        </div>
      </Section>

      <Section title="Proposal site">
        <div>
          <label className={labelCls}>Total area of land (m²)</label>
          <input type="text" inputMode="decimal" name="siteArea" placeholder="e.g. 1,234.5" className={inputCls} />
        </div>
      </Section>

      {state?.error && (
        <div className="flex items-start gap-2 text-sm text-error bg-error-bg border border-error/40 rounded-md px-4 py-3 mb-4">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-error" />
          <span>{state.error}</span>
        </div>
      )}
      <p className="text-xs text-placeholder mb-2">
        A project can only be created once the details a certificate needs are filled in — the address, scope, lot, council, applicant, certifier, NCC version, classification and cost.
      </p>
      <button disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
