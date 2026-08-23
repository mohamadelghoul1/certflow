"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateJobDetails,
  updateClientContact,
  addSharedAccess,
  removeSharedAccess,
  addClientAndShare,
} from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";
import {
  BCA_VERSIONS,
  BCA_VOLUMES,
  BUILDING_CLASSIFICATIONS,
  CLIENT_TYPES,
  CONSTRUCTION_TYPES,
  NSW_STATE,
  SEPP_CODE_PARTS,
  COUNCIL_DIRECTORY,
  epiForCodeParts,
} from "@/lib/constants";
import { formatISODate } from "@/lib/business";
import { AddressLookupField } from "@/components/certifier/AddressLookupField";
import { CriticalStageInspections } from "@/components/certifier/CriticalStageInspections";
import { DeleteJobButton } from "@/components/certifier/DeleteJobButton";
import { useSelectTab } from "@/components/certifier/JobTabs";
import type { Job, ClientContact } from "@/types/db";
import { DateField } from "@/components/DateField";

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-xs font-semibold text-placeholder mb-1";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0 space-y-4">
      <div className="text-xs font-bold uppercase tracking-wide text-placeholder">{title}</div>
      {children}
    </div>
  );
}

// One portal contact's details, editable in place. Contacts change their
// phone or email part-way through a job, and previously the only way to
// fix that was Settings -> Clients; now it's next to Remove, where the
// contact is actually listed.
function ContactRow({
  jobId,
  contact,
  onRemove,
}: {
  jobId: string;
  contact: ClientContact;
  onRemove?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateClientContact, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) setEditing(false);
    wasPending.current = pending;
  }, [pending, state]);

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <span>
          {contact.name} <span className="text-placeholder">({contact.type})</span>
          {(contact.email || contact.phone) && <span className="text-placeholder"> · {[contact.email, contact.phone].filter(Boolean).join(" · ")}</span>}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
            Edit
          </button>
          {onRemove}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="border border-line rounded-md p-3 space-y-2">
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="client_id" value={contact.id} />
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Name</label>
          <input name="name" defaultValue={contact.name} required autoFocus className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select name="type" defaultValue={contact.type} className={inputCls}>
            {CLIENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Company</label>
          <input name="company" defaultValue={contact.company || ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input name="phone" defaultValue={contact.phone || ""} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Email (used for portal invites and notifications)</label>
          <input type="email" name="email" defaultValue={contact.email || ""} className={inputCls} />
        </div>
      </div>
      {state?.error && <div className="text-xs text-error">{state.error}</div>}
      <div className="flex gap-2">
        <button disabled={pending} className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-muted hover:bg-hover">
          Cancel
        </button>
      </div>
    </form>
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
  email: string;
};

export function DetailsTab({
  job,
  clients,
  sharedClients,
}: {
  job: Job;
  clients: ClientContact[];
  sharedClients: { id: string; name: string; type: string }[];
}) {
  const d = job.details || {};
  const detailsFormId = `job-details-${job.id}`;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateJobDetails, undefined);
  const [showSaved, setShowSaved] = useState(false);
  const wasPending = useRef(false);
  const selectTab = useSelectTab();

  const [council, setCouncil] = useState<CouncilState>({
    lga: d.council?.lga || "",
    streetNumber: d.council?.address?.streetNumber || "",
    street: d.council?.address?.street || "",
    suburb: d.council?.address?.suburb || "",
    state: d.council?.address?.state || "NSW",
    postcode: d.council?.address?.postcode || "",
    phone: d.council?.contact?.phone || "",
    email: d.council?.contact?.email || "",
  });
  const [portalClientId, setPortalClientId] = useState(job.client_id || "");
  const [address, setAddress] = useState(job.address || "");
  const [zoning, setZoning] = useState(d.zoning || "");
  const [lotSectionDp, setLotSectionDp] = useState(d.certificateDetails?.lotSectionDp || "");
  const [codeParts, setCodeParts] = useState<Set<string>>(new Set(d.certificateDetails?.codeParts || []));
  const [shareClientId, setShareClientId] = useState("");
  const availableToShare = clients.filter((c) => c.id !== job.client_id && !sharedClients.some((s) => s.id === c.id));
  const clientsById = new Map(clients.map((c) => [c.id, c]));
  const primaryClient = job.client_id ? clientsById.get(job.client_id) : undefined;
  const [addingNewClient, setAddingNewClient] = useState(false);
  const [addClientState, addClientAction, addClientPending] = useActionState<ActionState, FormData>(addClientAndShare, undefined);

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

  useEffect(() => {
    // The flag is cleared before anything else, so a save hands over
    // exactly once. It used to be set after an early return, which left
    // it stuck on and made every later render look like a fresh save —
    // so the tab kept being forced back and clicking Details bounced
    // straight out again.
    const justSaved = wasPending.current && !pending;
    wasPending.current = pending;
    if (!justSaved || state?.error) return;

    setShowSaved(true);
    // Details are almost always filled in on the way to working on the
    // certificate, so saving hands straight over to that tab instead of
    // leaving the certifier at the bottom of a long form.
    selectTab("pathway");
    window.scrollTo({ top: 0 });
    const t = setTimeout(() => setShowSaved(false), 2500);
    return () => clearTimeout(t);
  }, [pending, state, selectTab]);

  const wasAddClientPending = useRef(false);
  useEffect(() => {
    if (wasAddClientPending.current && !addClientPending && !addClientState?.error) {
      setAddingNewClient(false);
    }
    wasAddClientPending.current = addClientPending;
  }, [addClientPending, addClientState]);

  return (
    <div className="space-y-6">
      <form id={detailsFormId} action={formAction} className="bg-white rounded-lg border border-line p-5">
        <input type="hidden" name="job_id" value={job.id} />
        <input type="hidden" name="pathway" value={job.pathway} />

        <Section title="Project configuration">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Project number</label>
                <input name="projectNumber" defaultValue={d.projectNumber || ""} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>NSW Planning Portal ref</label>
                <input name="planningPortalRef" defaultValue={d.certificateDetails?.planningPortalRef || ""} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>BCA / NCC version</label>
              <input name="bcaVersion" list="bca-version-list-edit" defaultValue={d.bcaVersion || ""} placeholder="e.g. NCC 2022" className={inputCls} />
              <datalist id="bca-version-list-edit">
                {BCA_VERSIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {BCA_VOLUMES.map((v) => (
                  <label key={v} className="flex items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" name="bcaVolumes" value={v} defaultChecked={(d.bcaVolumes || []).includes(v)} className="accent-icon" />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <AddressLookupField
            address={address}
            onAddressChange={setAddress}
            lotSectionDp={lotSectionDp}
            onLotSectionDpChange={setLotSectionDp}
            onCouncilMatched={selectCouncil}
            councilLga={council.lga}
            zoning={zoning}
            onZoningChange={setZoning}
            addressLabel="Development street address"
          />
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
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Phone</label>
              <input name="contact_phone" defaultValue={d.contact?.phone || ""} className={inputCls} />
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
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="ownerSameAsApplicant" defaultChecked={d.ownerSameAsApplicant !== false} className="accent-icon" />
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
                <input name="developmentConsentNumber" defaultValue={d.certificateDetails?.developmentConsentNumber || ""} placeholder="e.g. DA-25-01431" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Development Consent (DA) Date</label>
                <DateField name="developmentConsentDate" defaultValue={d.certificateDetails?.developmentConsentDate || ""} className={inputCls} />
              </div>
            </div>
          )}
          {d.certificateDetails?.determinationDate && (
            <div className="text-xs text-placeholder">
              Date of determination: <span className="font-medium text-muted">{formatISODate(d.certificateDetails.determinationDate)}</span> — set automatically when the{" "}
              {job.pathway} is issued.
            </div>
          )}
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
                  <input type="checkbox" name="classifications" value={c} defaultChecked={d.proposal?.classifications?.includes(c)} className="accent-icon" />
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
            <input type="number" step="any" name="effectiveHeight" defaultValue={d.proposal?.effectiveHeight || ""} className={inputCls} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Existing floor area (m²)</label>
              <input type="text" inputMode="decimal" name="floorAreaExisting" defaultValue={d.proposal?.floorAreaExisting || ""} placeholder="e.g. 123.4" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>New floor area (m²)</label>
              <input type="text" inputMode="decimal" name="floorAreaNew" defaultValue={d.proposal?.floorAreaNew || ""} placeholder="e.g. 123.4" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Site area (m²)</label>
            <input type="text" inputMode="decimal" name="siteArea" defaultValue={d.siteArea || ""} placeholder="e.g. 1,234.5" className={inputCls} />
          </div>
        </Section>

        <Section title="Scope of works">
          <p className="text-xs text-placeholder -mt-2">Shown as &ldquo;Description of Building Works&rdquo; on the certificate and &ldquo;Scope of Building Works&rdquo; on the inspections notice.</p>
          <textarea name="description" defaultValue={job.description || ""} rows={2} className={inputCls} />
        </Section>

      </form>

      <div className="bg-white rounded-lg border border-line p-5">
        <div className="font-bold text-primary mb-3">Client portal access</div>
        <div className="flex items-center gap-2">
          <select name="client_id" form={detailsFormId} value={portalClientId} onChange={(e) => setPortalClientId(e.target.value)} className={inputCls}>
            <option value="">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-placeholder mt-2">Assign an existing client for portal access, or add a new one under Settings. Saved when you press Save details at the bottom of the page.</p>
        {primaryClient && (
          <div className="mt-2">
            <ContactRow jobId={job.id} contact={primaryClient} />
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-line">
          <div className="text-xs font-semibold text-placeholder mb-2">Additional shared access (e.g. the owner, alongside the primary contact)</div>
          <div className="space-y-1.5 mb-2">
            {sharedClients.map((c) => (
              <ContactRow
                key={c.id}
                jobId={job.id}
                contact={clientsById.get(c.id) || ({ ...c, firm_id: "", company: null, email: null, phone: null, user_id: null } as ClientContact)}
                onRemove={
                  <form action={removeSharedAccess}>
                    <input type="hidden" name="job_id" value={job.id} />
                    <input type="hidden" name="client_id" value={c.id} />
                    <button className="text-xs text-error hover:underline">Remove</button>
                  </form>
                }
              />
            ))}
            {sharedClients.length === 0 && <div className="text-xs text-placeholder">No additional people have access yet.</div>}
          </div>
          {availableToShare.length > 0 && (
            <form action={addSharedAccess} onSubmit={() => setShareClientId("")} className="flex items-center gap-2 mb-2">
              <input type="hidden" name="job_id" value={job.id} />
              <select name="client_id" value={shareClientId} onChange={(e) => setShareClientId(e.target.value)} className={inputCls}>
                <option value="">— Select an existing client —</option>
                {availableToShare.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
              <button
                disabled={!shareClientId}
                className="px-3 py-2 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </form>
          )}

          {addingNewClient ? (
            <form action={addClientAction} className="border border-line rounded-md p-3 space-y-2 mt-2">
              <input type="hidden" name="job_id" value={job.id} />
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Name</label>
                  <input name="name" required autoFocus className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select name="type" defaultValue="Owner" className={inputCls}>
                    {CLIENT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Company</label>
                  <input name="company" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input name="phone" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Email (needed to invite them to the portal)</label>
                  <input type="email" name="email" className={inputCls} />
                </div>
              </div>
              {addClientState?.error && <div className="text-xs text-error">{addClientState.error}</div>}
              <div className="flex gap-2">
                <button disabled={addClientPending} className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60">
                  {addClientPending ? "Adding…" : "Add & share access"}
                </button>
                <button type="button" onClick={() => setAddingNewClient(false)} className="px-3 py-1.5 rounded-md text-xs text-muted hover:bg-hover">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setAddingNewClient(true)} className="text-xs font-medium text-primary hover:underline">
              + Add a new client and share access
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-line p-5">
        <div className="font-bold text-primary mb-1">Critical stage inspections</div>
        <p className="text-xs text-placeholder mb-3">
          Which critical stage inspections apply to this project — shown on the Mandatory Inspections Notice in the certificate package. Click one to edit its wording, or add extra
          inspections specific to this job. Saved when you press Save details at the bottom of the page.
        </p>
        <CriticalStageInspections jobId={job.id} items={job.critical_stage_inspections} formId={detailsFormId} />
      </div>

      {/* The Save button sits at the very bottom of the page rather than at
          the foot of the details card, so it's the last thing reached after
          working down the whole page. `form` ties it back to the details
          form it submits, which is allowed to live anywhere on the page. */}
      <div className="flex items-center gap-3 bg-white rounded-lg border border-line p-5">
        <button form={detailsFormId} disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save details"}
        </button>
        {showSaved && <span className="text-sm font-medium text-success">Saved ✓</span>}
        {state?.error && <span className="text-sm text-error">{state.error}</span>}
      </div>

      <div className="bg-white rounded-lg border border-line p-5">
        <DeleteJobButton jobId={job.id} address={job.address || ""} />
      </div>
    </div>
  );
}
