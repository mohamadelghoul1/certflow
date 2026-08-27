"use client";

import { useActionState, useState } from "react";
import {
  updateFirm,
  addCertifier,
  updateCertifier,
  removeCertifier,
  updateCertifierSignature,
  removeCertifierSignature,
  updateCertifierPracticeLogo,
  removeCertifierPracticeLogo,
  updateFirmLogo,
  removeFirmLogo,
  updateFirmStamp,
  removeFirmStamp,
  addClient,
  updateClient,
  removeClient,
  inviteClient,
} from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/auth";
import type { Firm, Certifier, ClientContact } from "@/types/db";
import { CLIENT_TYPES } from "@/lib/constants";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { DateField } from "@/components/DateField";

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-xs font-semibold text-placeholder mb-1";

export function FirmForm({ firm, logoUrl, stampUrl }: { firm: Firm | null; logoUrl?: string; stampUrl?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateFirm, undefined);
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Firm logo</label>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Firm logo" className="h-14 border border-line rounded bg-white px-2 py-1" />
          ) : (
            <span className="text-xs text-placeholder">No logo uploaded — shown on generated certificates and reports once added.</span>
          )}
          <ActionUpload action={updateFirmLogo} fields={{}} pathPrefix={`${firm?.id || "firm"}/logo`} label={logoUrl ? "Replace logo" : "Upload logo"} />
          {logoUrl && (
            <form action={removeFirmLogo}>
              <button className="text-xs text-error hover:underline">Remove</button>
            </form>
          )}
        </div>
      </div>

      <div>
        <label className={labelCls}>Approval stamp</label>
        <div className="flex items-center gap-3">
          {stampUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stampUrl} alt="Approval stamp" className="h-14 border border-line rounded bg-white px-2 py-1" />
          ) : (
            <span className="text-xs text-placeholder">
              No stamp uploaded — approved documents are stamped with your firm name, the certificate number, and the signing certifier&rsquo;s name and registration number.
            </span>
          )}
          <ActionUpload action={updateFirmStamp} fields={{}} pathPrefix={`${firm?.id || "firm"}/stamp`} label={stampUrl ? "Replace stamp" : "Upload stamp"} />
          {stampUrl && (
            <form action={removeFirmStamp}>
              <button className="text-xs text-error hover:underline">Remove</button>
            </form>
          )}
        </div>
        <p className="text-[11px] text-placeholder mt-1">A PNG or JPEG of your own stamp. It sits above the certificate and registration details, which are always printed.</p>
      </div>

      <form action={formAction} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Firm name</label>
          <input name="name" defaultValue={firm?.name || ""} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>ABN</label>
          <input name="abn" defaultValue={firm?.abn || ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Postal address</label>
          <input name="postal_address" defaultValue={firm?.postal_address || ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Office address</label>
          <input name="office_address" defaultValue={firm?.office_address || ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input name="phone" defaultValue={firm?.phone || ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input name="email" defaultValue={firm?.email || ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Website</label>
          <input name="website" defaultValue={firm?.website || ""} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>NSW Planning Portal account email</label>
          <input name="portal_email" type="email" defaultValue={firm?.portal_email || ""} placeholder="the email the company signs into the Planning Portal with" className={inputCls} />
          <p className="text-[11px] text-muted mt-1">
            Inspections reported to the Portal go up under this account automatically. A certifier with their own Portal login can carry it on their own row below, which takes over for
            their inspections.
          </p>
        </div>
        <div className="sm:col-span-2 pt-1 border-t border-line">
          <label className="flex items-center gap-2 text-sm text-muted mt-2">
            <input type="checkbox" name="document_reminders_enabled" defaultChecked={firm?.document_reminders_enabled !== false} className="accent-icon" />
            Automatically remind clients about outstanding documents
          </label>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted">
            Send a reminder every
            <input
              type="number"
              name="document_reminder_days"
              min={1}
              max={90}
              defaultValue={firm?.document_reminder_days || 7}
              className="w-16 px-2 py-1 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon"
            />
            days while documents are outstanding
          </div>
          <p className="text-[11px] text-muted mt-1">
            Only clients who still owe documents are emailed, listing exactly what&rsquo;s missing with a link to their portal. Any project can be paused individually from its own page.
          </p>
        </div>
        <div className="sm:col-span-2 pt-1 border-t border-line">
          <label className={`${labelCls} mt-2`}>Payment details (printed on every invoice)</label>
          <textarea
            name="payment_details"
            rows={3}
            defaultValue={firm?.payment_details || ""}
            placeholder={"Account name: \u2026\nBSB: \u2026    Account number: \u2026\nPlease use the invoice number as the payment reference."}
            className={inputCls}
          />
          <p className="text-[11px] text-muted mt-1">
            Copied onto each new invoice automatically — an already-issued invoice keeps the details it went out with.
          </p>
          <label className="flex items-center gap-2 text-sm text-muted mt-4">
            <input type="checkbox" name="card_surcharge_enabled" defaultChecked={firm?.card_surcharge_enabled === true} className="accent-icon" />
            Add the card-processing cost as a surcharge when a client pays by card
          </label>
          <p className="text-[11px] text-muted mt-1">
            The surcharge equals Stripe&rsquo;s standard fee (1.7% + 30&cent;), shown to the client before they pay; bank transfer stays surcharge-free. Only lawful at your actual card
            cost — leave this off if Stripe has given you a cheaper negotiated rate. Australia bans card surcharges from 1 October 2026, and CertFlow stops adding it automatically
            from that date.
          </p>
        </div>
      </div>
      {state?.error && <div className="text-sm text-error">{state.error}</div>}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save firm details"}
      </button>
      </form>
    </div>
  );
}

export function CertifierList({ certifiers, firmId, signatureUrls, practiceLogoUrls }: { certifiers: Certifier[]; firmId: string; signatureUrls: Record<string, string>; practiceLogoUrls?: Record<string, string> }) {
  const [adding, setAdding] = useState(false);
  const [addState, addAction, addPending] = useActionState<ActionState, FormData>(addCertifier, undefined);

  return (
    <div className="space-y-3">
      {certifiers.map((c) => (
        <CertifierRow key={c.id} certifier={c} firmId={firmId} signatureUrl={signatureUrls[c.id]} practiceLogoUrl={practiceLogoUrls?.[c.id]} />
      ))}
      {certifiers.length === 0 && <div className="text-sm text-placeholder">No certifiers yet.</div>}

      {adding ? (
        <form action={addAction} className="border border-line rounded-md p-4 space-y-3 mt-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input name="name" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Registration No.</label>
              <input name="registration_no" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Registration body</label>
              <input name="registration_body" className={inputCls} />
            </div>
            <div />
            <div>
              <label className={labelCls}>PI insurance expiry</label>
              <DateField name="pi_insurance_expiry" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Registration expiry</label>
              <DateField name="registration_expiry" className={inputCls} />
            </div>
          </div>
          {addState?.error && <div className="text-sm text-error">{addState.error}</div>}
          <div className="flex gap-2">
            <button disabled={addPending} className="px-3 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
              {addPending ? "Adding…" : "Add certifier"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-hover">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm font-medium text-primary hover:underline">
          + Add certifier
        </button>
      )}
    </div>
  );
}

function CertifierRow({ certifier, firmId, signatureUrl, practiceLogoUrl }: { certifier: Certifier; firmId: string; signatureUrl?: string; practiceLogoUrl?: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateCertifier, undefined);

  if (!editing) {
    return (
      <div className="flex items-center justify-between border border-line rounded-md px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-primary">{certifier.name}</div>
          <div className="text-xs text-placeholder">
            {certifier.registration_no} · {certifier.registration_body}
          </div>
          {/* Visible without opening Edit: which of your certifiers are
              contractors is the sort of thing you want to see at a glance
              rather than by checking each one in turn. */}
          {certifier.practice_name && (
            <div className="text-[11px] text-secondary font-medium mt-0.5">
              Contract certifier — inspections go out as {certifier.practice_name}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            {signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signatureUrl} alt={`${certifier.name} signature`} className="h-10 border border-line rounded bg-white px-2" />
            ) : (
              <span className="text-[11px] text-placeholder">No signature uploaded</span>
            )}
            <ActionUpload
              action={updateCertifierSignature}
              fields={{ id: certifier.id }}
              pathPrefix={`${firmId}/signatures/${certifier.id}`}
              label={signatureUrl ? "Replace signature" : "Upload signature"}
            />
            {signatureUrl && (
              <form action={removeCertifierSignature}>
                <input type="hidden" name="id" value={certifier.id} />
                <button className="text-xs text-error hover:underline">Remove</button>
              </form>
            )}
          </div>
          {/* Only for a contract certifier: their own company's logo, for
              the letterhead their inspection reports go out on. */}
          {certifier.practice_name && (
            <div className="flex items-center gap-2 mt-2">
              {practiceLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={practiceLogoUrl} alt={`${certifier.practice_name} logo`} className="h-10 border border-line rounded bg-white px-2" />
              ) : (
                <span className="text-[11px] text-placeholder">{certifier.practice_name} — no logo uploaded</span>
              )}
              <ActionUpload
                action={updateCertifierPracticeLogo}
                fields={{ id: certifier.id }}
                pathPrefix={`${firmId}/practice-logos/${certifier.id}`}
                label={practiceLogoUrl ? "Replace company logo" : "Upload company logo"}
              />
              {practiceLogoUrl && (
                <form action={removeCertifierPracticeLogo}>
                  <input type="hidden" name="id" value={certifier.id} />
                  <button className="text-xs text-error hover:underline">Remove</button>
                </form>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
            Edit
          </button>
          <form action={removeCertifier}>
            <input type="hidden" name="id" value={certifier.id} />
            <button className="text-xs text-error hover:underline">Remove</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="border border-line rounded-md p-4 space-y-3">
      <input type="hidden" name="id" value={certifier.id} />
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Name</label>
          <input name="name" defaultValue={certifier.name} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Registration No.</label>
          <input name="registration_no" defaultValue={certifier.registration_no || ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Registration body</label>
          <input name="registration_body" defaultValue={certifier.registration_body || ""} className={inputCls} />
        </div>
        <div />
        <div>
          <label className={labelCls}>PI insurance expiry</label>
          <DateField name="pi_insurance_expiry" defaultValue={certifier.pi_insurance_expiry || ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Registration expiry</label>
          <DateField name="registration_expiry" defaultValue={certifier.registration_expiry || ""} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>NSW Planning Portal login email</label>
          <input name="portal_email" type="email" defaultValue={certifier.portal_email || ""} placeholder="the email this certifier signs into the Portal with" className={inputCls} />
          <p className="text-[11px] text-muted mt-1">
            Inspections reported to the Portal go up under this account, and the Portal refuses an email it doesn&rsquo;t know. It&rsquo;s the Portal website login — not necessarily the
            CertFlow one.
          </p>
        </div>
      </div>

      {/* A certifier who works as a contractor rather than an employee —
          their own company, their own ABN, their own registration. Fill
          this in and their inspection reports go out on their letterhead
          instead of the firm's; leave it blank and nothing changes.
          Certificates and letters are the firm's own documents and stay
          on the firm's letterhead either way. */}
      <details open={!!certifier.practice_name} className="border-t border-line pt-3">
        <summary className="text-sm font-semibold text-secondary cursor-pointer hover:underline">
          Contract certifier — use their own company letterhead for inspection reports
        </summary>
        <p className="text-[11px] text-muted mt-2 mb-3">
          For a certifier working under their own registration rather than as an employee. Their inspection reports carry these details instead of the
          firm&rsquo;s. Leave the company name blank for an employee.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Company name</label>
            <input name="practice_name" defaultValue={certifier.practice_name || ""} placeholder="Leave blank for an employee" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>ABN</label>
            <input name="practice_abn" defaultValue={certifier.practice_abn || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Postal address</label>
            <input name="practice_postal_address" defaultValue={certifier.practice_postal_address || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Office address</label>
            <input name="practice_office_address" defaultValue={certifier.practice_office_address || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input name="practice_phone" defaultValue={certifier.practice_phone || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input name="practice_email" defaultValue={certifier.practice_email || ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input name="practice_website" defaultValue={certifier.practice_website || ""} className={inputCls} />
          </div>
        </div>
      </details>

      {state?.error && <div className="text-sm text-error">{state.error}</div>}
      <div className="flex gap-2">
        <button disabled={pending} className="px-3 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-hover">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ClientList({ clients }: { clients: ClientContact[] }) {
  const [adding, setAdding] = useState(false);
  const [addState, addAction, addPending] = useActionState<ActionState, FormData>(addClient, undefined);

  return (
    <div className="space-y-3">
      {clients.map((c) => (
        <ClientRow key={c.id} client={c} />
      ))}
      {clients.length === 0 && <div className="text-sm text-placeholder">No clients yet — add one below, then assign them to a project.</div>}

      {adding ? (
        <form action={addAction} className="border border-line rounded-md p-4 space-y-3 mt-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input name="name" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select name="type" className={inputCls} defaultValue="Owner">
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
          {addState?.error && <div className="text-sm text-error">{addState.error}</div>}
          <div className="flex gap-2">
            <button disabled={addPending} className="px-3 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
              {addPending ? "Adding…" : "Add client"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-hover">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm font-medium text-primary hover:underline">
          + Add client
        </button>
      )}
    </div>
  );
}

function ClientRow({ client }: { client: ClientContact }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateClient, undefined);

  if (!editing) {
    return (
      <div className="flex items-center justify-between border border-line rounded-md px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-primary">
            {client.name} <span className="font-normal text-placeholder">({client.type})</span>
          </div>
          <div className="text-xs text-placeholder">{client.email || "No email on file"}</div>
        </div>
        <div className="flex items-center gap-3">
          {client.email && (
            <form action={inviteClient}>
              <input type="hidden" name="client_id" value={client.id} />
              <button className="text-xs text-primary hover:underline">{client.user_id ? "Resend invite" : "Invite to portal"}</button>
            </form>
          )}
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
            Edit
          </button>
          <form action={removeClient}>
            <input type="hidden" name="id" value={client.id} />
            <button className="text-xs text-error hover:underline">Remove</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="border border-line rounded-md p-4 space-y-3">
      <input type="hidden" name="id" value={client.id} />
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Name</label>
          <input name="name" defaultValue={client.name} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select name="type" defaultValue={client.type} className={inputCls}>
            {CLIENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Company</label>
          <input name="company" defaultValue={client.company || ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input name="phone" defaultValue={client.phone || ""} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Email</label>
          <input type="email" name="email" defaultValue={client.email || ""} className={inputCls} />
        </div>
      </div>
      {state?.error && <div className="text-sm text-error">{state.error}</div>}
      <div className="flex gap-2">
        <button disabled={pending} className="px-3 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-hover">
          Cancel
        </button>
      </div>
    </form>
  );
}
