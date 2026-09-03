"use client";

import { useActionState, useState, useTransition } from "react";
import { ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { beginTwoFactorSetup, confirmTwoFactorSetup, cancelTwoFactorSetup, disableTwoFactor, type SetupState, type CodeState } from "@/lib/actions/twoFactor";
import { formatISODate } from "@/lib/business";
import { SubmitButton } from "@/components/SubmitButton";

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";

// The second step of signing in, switched on and off from here.
//
// An authenticator app — Google Authenticator, Microsoft Authenticator,
// 1Password, any of them — is scanned once and then asked for a code at
// every sign-in. The set-up is the three things a person needs: the QR
// code, the secret in text for a phone that cannot scan, and a box for
// the first code to prove the app is working before it is relied on.

export function SecuritySection({ factor }: { factor: { id: string; createdAt: string } | null }) {
  const [setup, setSetup] = useState<SetupState>(undefined);
  const [starting, startTransition] = useTransition();
  const [confirmState, confirm, confirming] = useActionState<SetupState, FormData>(confirmTwoFactorSetup, undefined);
  const [offState, turnOff, turningOff] = useActionState<CodeState, FormData>(disableTwoFactor, undefined);

  // What the set-up form shows: the confirm action hands the QR code
  // and secret back with a wrong-code error, so a mistyped code does
  // not throw the person back to the start.
  const live = confirmState?.factorId ? confirmState : setup;

  if (factor) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success-bg px-4 py-3">
          <ShieldCheck size={18} className="text-success mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold text-heading">Two-factor sign-in is on</div>
            <div className="text-muted mt-0.5">Set up {formatISODate(factor.createdAt)}. Every sign-in asks for a code from your authenticator app as well as your password.</div>
          </div>
        </div>
        <form action={turnOff} className="rounded-lg border border-line p-4">
          <input type="hidden" name="factor_id" value={factor.id} />
          <div className="text-sm font-semibold text-heading">Switch it off</div>
          <p className="text-xs text-muted mt-1 mb-3">
            Your password alone will open the account again. If you are changing phones, switch it off here first, then set it up again on the new one.
          </p>
          <SubmitButton disabled={turningOff} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-error/40 text-xs font-semibold text-error hover:bg-error-bg disabled:opacity-60">
            <ShieldOff size={13} /> {turningOff ? "Switching off…" : "Switch off two-factor sign-in"}
          </SubmitButton>
          {offState?.error && <p className="text-xs text-error mt-2">{offState.error}</p>}
        </form>
      </div>
    );
  }

  if (confirmState?.done) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success-bg px-4 py-3 max-w-xl">
        <ShieldCheck size={18} className="text-success mt-0.5 shrink-0" />
        <div className="text-sm">
          <div className="font-semibold text-heading">Two-factor sign-in is on</div>
          <div className="text-muted mt-0.5">From your next sign-in, Certlyn will ask for a code from your authenticator app.</div>
        </div>
      </div>
    );
  }

  if (!live?.factorId) {
    return (
      <div className="space-y-4 max-w-xl">
        <p className="text-sm text-muted">
          Two-factor sign-in asks for a six-digit code from an authenticator app on your phone as well as your password. A stolen or guessed
          password is then not enough to open your firm&rsquo;s projects.
        </p>
        <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
          <li>Install an authenticator app if you don&rsquo;t have one — Google Authenticator or Microsoft Authenticator are free.</li>
          <li>Press the button below and scan the code it shows.</li>
          <li>Type in the first code the app gives you.</li>
        </ol>
        <button
          type="button"
          disabled={starting}
          onClick={() =>
            startTransition(async () => {
              setSetup(await beginTwoFactorSetup());
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
        >
          <Smartphone size={15} /> {starting ? "Preparing…" : "Set up two-factor sign-in"}
        </button>
        {setup?.error && <p className="text-xs text-error">{setup.error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="grid sm:grid-cols-[180px_1fr] gap-5 items-start">
        {/* The QR code comes back from Supabase as an SVG data URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={live.qrCode} alt="QR code to scan with your authenticator app" className="w-[180px] h-[180px] rounded-md border border-line bg-white" />
        <div className="text-sm text-muted space-y-2">
          <p>
            <span className="font-semibold text-heading">Scan this</span> with your authenticator app.
          </p>
          <p>
            Can&rsquo;t scan? Add an account by hand and enter this key:
            <code className="block mt-1 px-2 py-1.5 rounded bg-surface border border-line text-xs text-heading break-all select-all">{live.secret}</code>
          </p>
        </div>
      </div>

      <form action={confirm} className="rounded-lg border border-line p-4 space-y-3">
        <input type="hidden" name="factor_id" value={live.factorId} />
        <input type="hidden" name="qr_code" value={live.qrCode || ""} />
        <input type="hidden" name="secret" value={live.secret || ""} />
        <label className="block text-xs font-semibold text-placeholder">Enter the six-digit code the app shows now</label>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus className={`${inputCls} sm:w-48 tracking-[0.3em] font-mono`} />
        <div className="flex items-center gap-3">
          <SubmitButton disabled={confirming} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
            {confirming ? "Checking…" : "Turn on"}
          </SubmitButton>
          <button type="submit" formAction={cancelTwoFactorSetup} formNoValidate className="text-xs text-muted hover:underline">
            Cancel
          </button>
        </div>
        {live.error && <p className="text-xs text-error">{live.error}</p>}
      </form>
    </div>
  );
}
