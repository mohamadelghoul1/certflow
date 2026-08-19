"use client";

import { useActionState, useState } from "react";
import { updateFirm, addCertifier, updateCertifier, removeCertifier, addClient, inviteClient } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/auth";
import type { Firm, Certifier, ClientContact } from "@/types/db";
import { CLIENT_TYPES } from "@/lib/constants";

const inputCls = "w-full px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

export function FirmForm({ firm }: { firm: Firm | null }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateFirm, undefined);
  return (
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
      </div>
      {state?.error && <div className="text-sm text-red-600">{state.error}</div>}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Saving…" : "Save firm details"}
      </button>
    </form>
  );
}

export function CertifierList({ certifiers }: { certifiers: Certifier[] }) {
  const [adding, setAdding] = useState(false);
  const [addState, addAction, addPending] = useActionState<ActionState, FormData>(addCertifier, undefined);

  return (
    <div className="space-y-3">
      {certifiers.map((c) => (
        <CertifierRow key={c.id} certifier={c} />
      ))}
      {certifiers.length === 0 && <div className="text-sm text-slate-400">No certifiers yet.</div>}

      {adding ? (
        <form action={addAction} className="border border-slate-200 rounded-md p-4 space-y-3 mt-3">
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
              <input type="date" name="pi_insurance_expiry" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Registration expiry</label>
              <input type="date" name="registration_expiry" className={inputCls} />
            </div>
          </div>
          {addState?.error && <div className="text-sm text-red-600">{addState.error}</div>}
          <div className="flex gap-2">
            <button disabled={addPending} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
              {addPending ? "Adding…" : "Add certifier"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm font-medium text-teal-800 hover:underline">
          + Add certifier
        </button>
      )}
    </div>
  );
}

function CertifierRow({ certifier }: { certifier: Certifier }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateCertifier, undefined);

  if (!editing) {
    return (
      <div className="flex items-center justify-between border border-slate-100 rounded-md px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-teal-900">{certifier.name}</div>
          <div className="text-xs text-slate-500">
            {certifier.registration_no} · {certifier.registration_body}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="text-xs text-teal-800 hover:underline">
            Edit
          </button>
          <form action={removeCertifier}>
            <input type="hidden" name="id" value={certifier.id} />
            <button className="text-xs text-red-600 hover:underline">Remove</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="border border-slate-200 rounded-md p-4 space-y-3">
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
          <input type="date" name="pi_insurance_expiry" defaultValue={certifier.pi_insurance_expiry || ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Registration expiry</label>
          <input type="date" name="registration_expiry" defaultValue={certifier.registration_expiry || ""} className={inputCls} />
        </div>
      </div>
      {state?.error && <div className="text-sm text-red-600">{state.error}</div>}
      <div className="flex gap-2">
        <button disabled={pending} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-50">
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
        <div key={c.id} className="flex items-center justify-between border border-slate-100 rounded-md px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-teal-900">
              {c.name} <span className="font-normal text-slate-400">({c.type})</span>
            </div>
            <div className="text-xs text-slate-500">{c.email || "No email on file"}</div>
          </div>
          {c.email && (
            <form action={inviteClient}>
              <input type="hidden" name="client_id" value={c.id} />
              <button className="text-xs text-teal-800 hover:underline">{c.user_id ? "Resend invite" : "Invite to portal"}</button>
            </form>
          )}
        </div>
      ))}
      {clients.length === 0 && <div className="text-sm text-slate-400">No clients yet — add one below, then assign them to a job.</div>}

      {adding ? (
        <form action={addAction} className="border border-slate-200 rounded-md p-4 space-y-3 mt-3">
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
          {addState?.error && <div className="text-sm text-red-600">{addState.error}</div>}
          <div className="flex gap-2">
            <button disabled={addPending} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
              {addPending ? "Adding…" : "Add client"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm font-medium text-teal-800 hover:underline">
          + Add client
        </button>
      )}
    </div>
  );
}
