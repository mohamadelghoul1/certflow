"use client";

import { useActionState, useRef, useState } from "react";
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
  matchCouncilByAddress,
  extractLotDpFromAddress,
  epiForCodeParts,
} from "@/lib/constants";
import { X } from "lucide-react";

const inputCls = "w-full px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

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
    <div className="bg-white rounded-lg border border-slate-200 mb-5">
      <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">{title}</div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export function NewJobForm({ certifiers, clients }: { certifiers: { id: string; name: string }[]; clients: { id: string; name: string; type: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createJob, undefined);
  const [types, setTypes] = useState<string[]>([]);
  const [customType, setCustomType] = useState("");
  const [pathway, setPathway] = useState<"CDC" | "CC">("CDC");
  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lotSectionDp, setLotSectionDp] = useState("");
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

  function applyAddress(v: string) {
    setAddress(v);
    if (!council.lga) {
      const match = matchCouncilByAddress(v);
      if (match) selectCouncil(match.name);
    }
    if (!lotSectionDp) {
      const lotDp = extractLotDpFromAddress(v);
      if (lotDp) setLotSectionDp(lotDp);
    }
  }

  function handleAddressChange(v: string) {
    applyAddress(v);

    if (addressDebounce.current) clearTimeout(addressDebounce.current);
    const trimmed = v.trim();
    if (trimmed.length < 4) {
      setAddressSuggestions([]);
      return;
    }
    addressDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-autocomplete?input=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setAddressSuggestions(data.suggestions || []);
        setShowAddressSuggestions(true);
      } catch {
        setAddressSuggestions([]);
      }
    }, 300);
  }

  function selectAddressSuggestion(v: string) {
    applyAddress(v);
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
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
      <div className="bg-teal-50 border border-teal-100 rounded-md px-4 py-3 mb-5 text-sm text-teal-800">
        This information is captured once and stays attached to the project — you can come back and edit it later from the Details tab.
      </div>

      <Section title="Project basics">
        <div className="relative">
          <label className={labelCls}>Property address</label>
          <input
            name="address"
            required
            value={address}
            onChange={(e) => handleAddressChange(e.target.value)}
            onFocus={() => addressSuggestions.length > 0 && setShowAddressSuggestions(true)}
            onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 150)}
            autoComplete="off"
            placeholder="e.g. Lot 12 DP123456, 12 Example Street, Suburb NSW 2000"
            className={inputCls}
          />
          {showAddressSuggestions && addressSuggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
              {addressSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={() => selectAddressSuggestion(s)}
                  className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-t border-slate-50 first:border-t-0"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {council.lga && <div className="text-[11px] text-teal-700 mt-1">Council: {council.lga} — auto-matched from the address, edit below if wrong.</div>}
        </div>
        <div>
          <label className={labelCls}>Lot / Section / DP</label>
          <input
            name="lotSectionDp"
            value={lotSectionDp}
            onChange={(e) => setLotSectionDp(e.target.value)}
            placeholder="e.g. 12/-/DP12345"
            className={inputCls}
          />
          <div className="text-[11px] text-slate-400 mt-1">Filled in automatically if the address includes &ldquo;Lot ... DP ...&rdquo; — edit if wrong.</div>
        </div>
        <div>
          <label className={labelCls}>Scope of works</label>
          <textarea name="description" rows={2} placeholder="e.g. Construction of a secondary dwelling" className={inputCls} />
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
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium ${active ? "bg-teal-800 text-white border-teal-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {t}
                </button>
              );
            })}
            {types
              .filter((t) => !JOB_TYPES.includes(t))
              .map((t) => (
                <span key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200">
                  {t}
                  <button type="button" onClick={() => setTypes((prev) => prev.filter((v) => v !== t))} className="hover:text-teal-900">
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
              className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600"
            />
            <button
              type="button"
              onClick={() => {
                const text = customType.trim();
                if (text && !types.includes(text)) setTypes((prev) => [...prev, text]);
                setCustomType("");
              }}
              className="px-3 py-2 rounded-md bg-teal-800 text-white text-sm font-medium hover:bg-teal-900"
            >
              Add
            </button>
          </div>
          {types.map((t) => (
            <input key={t} type="hidden" name="job_types" value={t} />
          ))}
        </div>
        <div>
          <label className={labelCls}>Pathway</label>
          <div className="flex gap-2">
            {(["CDC", "CC"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPathway(p)}
                className={`flex-1 py-2 rounded-md text-sm font-semibold border ${pathway === p ? "bg-teal-800 text-white border-teal-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                {p === "CDC" ? "Complying Development (CDC)" : "Construction Certificate (CC)"}
              </button>
            ))}
          </div>
          <input type="hidden" name="pathway" value={pathway} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Assigned certifier</label>
            <select name="assigned_certifier_id" className={inputCls} defaultValue="">
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
            <label className={labelCls}>Zoning</label>
            <input name="zoning" placeholder="e.g. R2 Low Density Residential" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>BCA / NCC version</label>
            <input name="bcaVersion" list="bca-version-list" placeholder="e.g. NCC 2022 Amendment 2" className={inputCls} />
            <datalist id="bca-version-list">
              {BCA_VERSIONS.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {BCA_VOLUMES.map((v) => (
                <label key={v} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" name="bcaVolumes" value={v} className="accent-teal-700" />
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
            <input name="applicantAddress_streetNumber" placeholder="No." className={inputCls} />
            <input name="applicantAddress_street" placeholder="Street" className={`${inputCls} sm:col-span-2`} />
            <input name="applicantAddress_suburb" placeholder="Suburb" className={inputCls} />
            <input name="applicantAddress_postcode" placeholder="Postcode" className={inputCls} />
          </div>
          <select name="applicantAddress_state" defaultValue="NSW" className={`${inputCls} mt-2 sm:w-40`}>
            {NSW_STATE.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Owner details">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="ownerSameAsApplicant" defaultChecked className="accent-teal-700" />
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

      <Section title={`${pathway} certificate details`}>
        <div>
          <label className={labelCls}>NSW Planning Portal ref number</label>
          <input name="planningPortalRef" placeholder="e.g. CDC-331766" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Other consent references (DA / Modification / Notice of Determination — one per line)</label>
          <textarea name="consentReferences" rows={2} placeholder={"e.g. REV2021/0004\nMOD2024/0395"} className={inputCls} />
        </div>
        {pathway === "CDC" ? (
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
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Development Consent (DA) Number</label>
              <input name="developmentConsentNumber" placeholder="e.g. DA-25-01431" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Development Consent (DA) Date</label>
              <input type="date" name="developmentConsentDate" className={inputCls} />
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
              <label key={c} className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" name="classifications" value={c} className="accent-teal-700" />
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
          <input type="number" name="estimatedCost" className={inputCls} />
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

      {state?.error && <div className="text-sm text-red-600 mb-4">{state.error}</div>}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
