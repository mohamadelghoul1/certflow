"use client";

import { useActionState, useState } from "react";
import {
  updateFirm,
  updateFirmReminders,
  updateFirmPayments,
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
  saveFirmStripe,
  disconnectFirmStripe,
  updateFirmSender,
  saveFirmEmailKey,
  disconnectFirmEmailKey,
} from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/auth";
import type { Firm, Certifier, ClientContact } from "@/types/db";
import type { InviteState } from "@/lib/actions/settings";
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
      </div>
      {state?.error && <div className="text-sm text-error">{state.error}</div>}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save firm details"}
      </button>
      </form>
    </div>
  );
}

// The chasing schedule, its own small form so it lives under its own
// Settings heading rather than at the bottom of the firm's identity.
export function ReminderSettingsForm({ firm }: { firm: Firm | null }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateFirmReminders, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="document_reminders_enabled" defaultChecked={firm?.document_reminders_enabled !== false} className="accent-icon" />
        Automatically remind clients about outstanding documents
      </label>
      <div className="flex items-center gap-2 text-sm text-muted">
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
      <p className="text-[11px] text-muted">
        Only clients who still owe documents are emailed, listing exactly what&rsquo;s missing with a link to their portal. Any project can be paused individually from its own page.
      </p>
      {state?.error && <div className="text-sm text-error">{state.error}</div>}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save reminder settings"}
      </button>
    </form>
  );
}

// How the firm gets paid: the bank details every invoice prints, and
// the optional card surcharge.
export function PaymentSettingsForm({ firm }: { firm: Firm | null }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateFirmPayments, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className={labelCls}>Payment details (printed on every invoice)</label>
        <textarea
          name="payment_details"
          rows={3}
          defaultValue={firm?.payment_details || ""}
          placeholder={"Account name: \u2026\nBSB: \u2026    Account number: \u2026\nPlease use the invoice number as the payment reference."}
          className={inputCls}
        />
        <p className="text-[11px] text-muted mt-1">Copied onto each new invoice automatically — an already-issued invoice keeps the details it went out with.</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="card_surcharge_enabled" defaultChecked={firm?.card_surcharge_enabled === true} className="accent-icon" />
        Add the card-processing cost as a surcharge when a client pays by card
      </label>
      <p className="text-[11px] text-muted">
        The surcharge equals Stripe&rsquo;s standard fee (1.7% + 30&cent;), shown to the client before they pay; bank transfer stays surcharge-free. Only lawful at your actual card
        cost — leave this off if Stripe has given you a cheaper negotiated rate. Australia bans card surcharges from 1 October 2026, and CertFlow stops adding it automatically from
        that date.
      </p>
      <label className="flex items-center gap-2 text-sm text-muted pt-2 border-t border-line">
        <input type="checkbox" name="invoice_reminders_enabled" defaultChecked={firm?.invoice_reminders_enabled !== false} className="accent-icon" />
        Automatically remind clients about overdue invoices
      </label>
      <div className="flex items-center gap-2 text-sm text-muted">
        Once overdue, remind every
        <input
          type="number"
          name="invoice_reminder_days"
          min={1}
          max={90}
          defaultValue={firm?.invoice_reminder_days || 7}
          className="w-16 px-2 py-1 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon"
        />
        days until it&rsquo;s marked paid
      </div>
      <p className="text-[11px] text-muted">
        Bank transfers aren&rsquo;t visible to CertFlow, so every reminder carries an &ldquo;if you&rsquo;ve already paid, please disregard&rdquo; line — and marking an invoice paid stops
        its reminders immediately. Any single invoice can be paused from its own page.
      </p>
      {state?.error && <div className="text-sm text-error">{state.error}</div>}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save payment settings"}
      </button>
    </form>
  );
}

// Who this firm's email comes from.
//
// Two settings that have to agree. The address is what a client sees;
// the Resend account is what actually sends it, and Resend will only
// send from a domain verified in the account whose key is used. Set the
// address without the account and mail either goes out under whoever
// this deployment belongs to, or is refused; set the account without the
// address and there is nothing valid to send as. Both are on this one
// screen so neither is done alone.
//
// The key is write-only, like the Stripe keys: this form is told whether
// one is set and nothing more.
export function EmailSenderForm({
  firm,
  status,
  effective,
  deploymentFrom,
  sharedDeployment,
}: {
  firm: Firm | null;
  status: { apiKeySet: boolean; updatedAt: string | null; installed: boolean };
  effective: { from: string; replyTo: string | null; ownAccount: boolean };
  deploymentFrom: string;
  // Whether another firm is running on this deployment. With one firm
  // the deployment's address is that firm's own, so saying it belongs to
  // somebody else would be a warning about nothing.
  sharedDeployment: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateFirmSender, undefined);
  const [keyState, keyAction, keyPending] = useActionState<ActionState, FormData>(saveFirmEmailKey, undefined);
  const [offState, offAction, offPending] = useActionState<ActionState, FormData>(disconnectFirmEmailKey, undefined);
  const [showKey, setShowKey] = useState(false);

  const ownName = !!(firm as { from_email?: string | null } | null)?.from_email;
  const nothingToSendAs = status.apiKeySet && !ownName;

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-line bg-surface p-3">
        <div className="text-[11px] font-semibold text-placeholder mb-1">Your clients currently see</div>
        {effective.from ? (
          <div className="text-sm text-primary font-medium break-all">{effective.from}</div>
        ) : (
          <div className="text-sm text-error font-medium">Nothing — no sending address is set, so no email can go out.</div>
        )}
        <div className="text-[11px] text-muted mt-0.5">
          {effective.replyTo ? `Replies go to ${effective.replyTo}.` : "Replies go back to the sending address."}
        </div>
        {!ownName && effective.from === deploymentFrom && (
          <div className={`text-[11px] mt-1.5 ${sharedDeployment ? "text-warning-text" : "text-muted"}`}>
            {sharedDeployment
              ? "That address belongs to another firm on this deployment, not to you. Until you set your own below, your clients see someone else's name on every certificate, invoice and reminder you send."
              : "That is coming from this deployment's own setting rather than from here. Filling in the boxes below puts it under your control, so you can change it yourself without touching Vercel."}
          </div>
        )}
        {nothingToSendAs && (
          <div className="text-[11px] text-error mt-1.5">
            You have your own Resend account connected but no sending address, so nothing can be sent. Fill in the address below.
          </div>
        )}
      </div>

      <form action={formAction} className="space-y-3">
        <div>
          <label className={labelCls}>Sending address</label>
          <input
            name="from_email"
            defaultValue={(firm as { from_email?: string | null } | null)?.from_email || ""}
            placeholder="Your Firm Pty Ltd <notifications@yourfirm.com.au>"
            className={inputCls}
          />
          <p className="text-[11px] text-muted mt-1">
            What every certificate, invoice, reminder and portal notification goes out as. Put your firm&rsquo;s name in front of the address and
            that is the name clients see in their inbox.
          </p>
        </div>
        <div>
          <label className={labelCls}>Replies go to</label>
          <input
            name="reply_to_email"
            defaultValue={(firm as { reply_to_email?: string | null } | null)?.reply_to_email || ""}
            placeholder="info@yourfirm.com.au"
            className={inputCls}
          />
          <p className="text-[11px] text-muted mt-1">
            Leave blank and replies go back to the sending address. Worth filling in if you send from an address nobody watches — otherwise a
            client&rsquo;s answer is simply lost.
          </p>
        </div>
        {state?.error && <div className="text-sm text-error">{state.error}</div>}
        <button disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save sending address"}
        </button>
      </form>

      <div className="pt-4 border-t border-line space-y-3">
        <div className="font-semibold text-primary text-sm">Your Resend account</div>

        {!status.installed ? (
          <p className="text-[11px] text-warning-text">
            Run database update 0060 first — Settings → System check shows what&rsquo;s been run. Until then, mail is sent through whichever Resend
            account this deployment was set up with.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className={`inline-block w-2 h-2 rounded-full ${status.apiKeySet ? "bg-success" : "bg-line"}`} />
              API key — {status.apiKeySet ? "set, mail leaves your own account" : "not set, mail leaves this deployment's account"}
            </div>

            <form action={keyAction} className="space-y-3">
              <div>
                <label className={labelCls}>
                  Resend API key {status.apiKeySet && <span className="font-normal text-muted">(paste a new one to replace it)</span>}
                </label>
                <input name="resend_api_key" type={showKey ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder="re_…" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted">
                <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} className="accent-icon" />
                Show what I&rsquo;m typing
              </label>
              {keyState?.error && <div className="text-sm text-error">{keyState.error}</div>}
              <button disabled={keyPending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
                {keyPending ? "Saving…" : status.apiKeySet ? "Replace key" : "Connect Resend"}
              </button>
            </form>

            <div className="rounded-md bg-surface border border-line p-3 space-y-1">
              <div className="text-[11px] font-semibold text-placeholder">How to get one</div>
              <ol className="text-[11px] text-muted list-decimal ml-4 space-y-0.5">
                <li>
                  Sign up at <span className="font-medium">resend.com</span> — the free tier covers a small certifier.
                </li>
                <li>Domains → Add domain → your firm&rsquo;s domain. Resend gives you three DNS records to add wherever your domain is managed.</li>
                <li>Once it shows Verified, go to API Keys → Create API key and paste it above.</li>
              </ol>
              <p className="text-[11px] text-muted">
                Resend only sends from a domain verified in your own account, so this is what makes the address above actually work. Once saved the
                key cannot be read back out of CertFlow by anyone; replace it by pasting a new one.
              </p>
            </div>

            {status.apiKeySet && (
              <form action={offAction}>
                {offState?.error && <div className="text-sm text-error mb-1">{offState.error}</div>}
                <button disabled={offPending} className="text-xs text-error hover:underline disabled:opacity-60">
                  {offPending ? "Disconnecting…" : "Disconnect Resend"}
                </button>
                <p className="text-[11px] text-muted mt-1">Mail goes back to this deployment&rsquo;s account, under whatever address it sends as.</p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// This firm's own Stripe account.
//
// Card payments used to be one account for the whole deployment, which
// is right for one firm and wrong the moment there are two: a second
// firm's client would press "Pay online" and the money would arrive in
// the first firm's bank account. Each firm connects its own here.
//
// The keys are write-only. Nothing on this page has ever held one — the
// server is told whether each is set and nothing more — because
// everything a form like this is given is serialised into the page and
// readable in the browser.
export function StripeConnectionForm({
  status,
  webhookUrl,
  deploymentConfigured,
}: {
  status: { secretKeySet: boolean; webhookSecretSet: boolean; updatedAt: string | null; installed: boolean };
  webhookUrl: string;
  deploymentConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveFirmStripe, undefined);
  const [disconnectState, disconnectAction, disconnecting] = useActionState<ActionState, FormData>(disconnectFirmStripe, undefined);
  const [showKeys, setShowKeys] = useState(false);

  const connected = status.secretKeySet;
  const dot = (on: boolean) => (on ? "bg-success" : "bg-line");

  return (
    <div className="pt-4 mt-4 border-t border-line space-y-3">
      <div className="font-semibold text-primary text-sm">Card payments (Stripe)</div>

      {!status.installed ? (
        <p className="text-[11px] text-warning-text">
          Run database update 0059 first — Settings → System check shows what&rsquo;s been run. Until then, card payments use whichever Stripe account
          is set up for this deployment.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className={`inline-block w-2 h-2 rounded-full ${dot(status.secretKeySet)}`} />
              Secret key — {status.secretKeySet ? "set" : "not set"}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className={`inline-block w-2 h-2 rounded-full ${dot(status.webhookSecretSet)}`} />
              Webhook signing secret — {status.webhookSecretSet ? "set" : "not set"}
            </div>
          </div>

          {connected && !status.webhookSecretSet && (
            <p className="text-[11px] text-warning-text">
              Clients can pay, but CertFlow won&rsquo;t hear about it — an invoice paid by card will stay showing as unpaid until the signing secret
              below is filled in.
            </p>
          )}
          {!connected && (
            <p className="text-[11px] text-muted">
              {deploymentConfigured
                ? "Not connected — card payments are going to the Stripe account set up for this deployment. Connect your own below and every payment from here on lands in your account instead."
                : "Not connected — the Pay online button won't appear on invoices until you connect a Stripe account."}
            </p>
          )}

          <form action={formAction} className="space-y-3">
            <div>
              <label className={labelCls}>Secret key {status.secretKeySet && <span className="font-normal text-muted">(leave blank to keep the one stored)</span>}</label>
              <input
                name="stripe_secret_key"
                type={showKeys ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                placeholder="sk_live_…"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Webhook signing secret {status.webhookSecretSet && <span className="font-normal text-muted">(leave blank to keep the one stored)</span>}
              </label>
              <input
                name="stripe_webhook_secret"
                type={showKeys ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                placeholder="whsec_…"
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-muted">
              <input type="checkbox" checked={showKeys} onChange={(e) => setShowKeys(e.target.checked)} className="accent-icon" />
              Show what I&rsquo;m typing
            </label>
            {state?.error && <div className="text-sm text-error">{state.error}</div>}
            <button disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
              {pending ? "Saving…" : connected ? "Update Stripe keys" : "Connect Stripe"}
            </button>
          </form>

          <div className="rounded-md bg-surface border border-line p-3 space-y-1">
            <div className="text-[11px] font-semibold text-placeholder">Where these come from</div>
            <ol className="text-[11px] text-muted list-decimal ml-4 space-y-0.5">
              <li>
                In Stripe, go to Developers → API keys and copy the <strong>secret key</strong>.
              </li>
              <li>
                Then Developers → Webhooks → Add endpoint. The URL is <code className="break-all">{webhookUrl}</code>, and the one event to send is{" "}
                <code>checkout.session.completed</code>.
              </li>
              <li>Stripe then shows that endpoint&rsquo;s signing secret — that is the second box above.</li>
            </ol>
            <p className="text-[11px] text-muted">
              Once saved, neither can be read back out of CertFlow — not by us, not by anyone logged in. Replace one by pasting a new one; if you
              think a key has got out, roll it in Stripe and paste the new one here.
            </p>
          </div>

          {connected && (
            <form action={disconnectAction}>
              {disconnectState?.error && <div className="text-sm text-error mb-1">{disconnectState.error}</div>}
              <button disabled={disconnecting} className="text-xs text-error hover:underline disabled:opacity-60">
                {disconnecting ? "Disconnecting…" : "Disconnect Stripe"}
              </button>
              <p className="text-[11px] text-muted mt-1">
                Removes both keys. Payment links already sent keep working in Stripe, but CertFlow will no longer mark those invoices paid on its own.
              </p>
            </form>
          )}
        </>
      )}
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
            <div>
              <label className={labelCls}>Email for notifications</label>
              <input name="email" type="email" placeholder="where client uploads and bookings are sent" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mobile</label>
              <input name="mobile" type="tel" placeholder="shown to clients for changing a booking" className={inputCls} />
            </div>
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
  // Saving closes the form — pressing Save and having the form simply
  // sit there read as nothing happening. A failure keeps it open with
  // the reason shown.
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function formAction(fd: FormData) {
    setPending(true);
    setError("");
    const result = await updateCertifier(undefined, fd);
    setPending(false);
    if (result?.error) setError(result.error);
    else setEditing(false);
  }

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
        <div>
          <label className={labelCls}>Email for notifications</label>
          <input name="email" type="email" defaultValue={certifier.email || ""} placeholder="where client uploads and bookings are sent" className={inputCls} />
        </div>
        {/* Deliberately not the firm's phone above: that one is the
            office line printed on every certificate, letterhead, quote
            and invoice. This is the number a builder rings when the slab
            will not be ready. */}
        <div>
          <label className={labelCls}>Mobile</label>
          <input name="mobile" type="tel" defaultValue={certifier.mobile || ""} placeholder="shown to clients for changing a booking" className={inputCls} />
        </div>
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

      {error && <div className="text-sm text-error">{error}</div>}
      <div className="flex gap-2">
        <button disabled={pending} className="px-3 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-hover">
          Cancel
        </button>
      </div>
    </form>
  );
}

// The invite with its outcome shown — an email that never went out must
// not look like one that did.
function InviteClientButton({ clientId, hasLogin }: { clientId: string; hasLogin: boolean }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteClient, undefined);
  return (
    <span className="inline-flex items-center gap-2">
      <form action={action}>
        <input type="hidden" name="client_id" value={clientId} />
        <button disabled={pending} className="text-xs text-primary hover:underline disabled:opacity-50">
          {pending ? "Sending…" : hasLogin ? "Resend invite" : "Invite to portal"}
        </button>
      </form>
      {state?.error && <span className="text-xs text-error max-w-56">{state.error}</span>}
      {state?.success && <span className="text-xs text-success">{state.success}</span>}
    </span>
  );
}

export function ClientList({ clients }: { clients: ClientContact[] }) {
  const [adding, setAdding] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  // Adding closes the form on success and returns to the list — an open
  // form with no signal reads as a hang. A rejected add stays open and
  // says why.
  async function add(fd: FormData) {
    setAddSaving(true);
    setAddError("");
    const result = await addClient(undefined, fd);
    setAddSaving(false);
    if (result?.error) setAddError(result.error);
    else setAdding(false);
  }

  return (
    <div className="space-y-3">
      {clients.map((c) => (
        <ClientRow key={c.id} client={c} />
      ))}
      {clients.length === 0 && <div className="text-sm text-placeholder">No clients yet — add one below, then assign them to a project.</div>}

      {adding ? (
        <form action={add} className="border border-line rounded-md p-4 space-y-3 mt-3">
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
          {addError && <div className="text-sm text-error">{addError}</div>}
          <div className="flex gap-2">
            <button disabled={addSaving} className="px-3 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
              {addSaving ? "Adding…" : "Add client"}
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Saving closes the form and returns to the list; a rejected save
  // stays open and says why.
  async function save(fd: FormData) {
    setSaving(true);
    setError("");
    const result = await updateClient(undefined, fd);
    setSaving(false);
    if (result?.error) setError(result.error);
    else setEditing(false);
  }

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
            <InviteClientButton clientId={client.id} hasLogin={!!client.user_id} />
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
    <form action={save} className="border border-line rounded-md p-4 space-y-3">
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
      {error && <div className="text-sm text-error">{error}</div>}
      <div className="flex gap-2">
        <button disabled={saving} className="px-3 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-hover">
          Cancel
        </button>
      </div>
    </form>
  );
}
