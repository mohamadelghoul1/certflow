"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Check, Copy, RefreshCw } from "lucide-react";
import { resetCalendarLink } from "@/lib/actions/calendar";
import type { ActionState } from "@/lib/actions/auth";

// Subscribing a phone to the inspection diary.
//
// The URL is the credential — anyone holding it can read the firm's
// inspection dates — so it is behind a press rather than printed on the
// page, and it can be replaced if it ends up somewhere it shouldn't.
export function CalendarSubscribe({ token, certifierId }: { token: string | null; certifierId: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(resetCalendarLink, undefined);

  if (!token || !certifierId) return null;

  // Built in the browser, because the address a certifier reaches this
  // on is the address their phone has to be given.
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/calendar/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (an insecure origin, or permission denied) —
      // the address is on screen and can be copied by hand.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 border border-line bg-white rounded-md px-3 py-2 text-xs font-semibold text-secondary hover:bg-hover"
      >
        <CalendarPlus size={14} /> Add to my phone
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[90vw] bg-white border border-line rounded-lg shadow-lg p-4 z-20">
          <div className="text-sm font-semibold text-heading mb-1">Your inspection calendar</div>
          <p className="text-xs text-muted mb-3">
            Add this address to your phone&rsquo;s calendar once. Every inspection booked from then on appears in it, and updates itself when a date
            changes.
          </p>

          <div className="flex items-center gap-2 mb-3">
            <input readOnly value={url} className="flex-1 min-w-0 border border-line rounded-md px-2 py-1.5 text-[11px] bg-surface text-muted" />
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 border border-line rounded-md px-2 py-1.5 text-xs font-semibold text-secondary hover:bg-hover shrink-0"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <details className="text-xs text-muted mb-3">
            <summary className="cursor-pointer font-semibold text-secondary">How to add it</summary>
            <ul className="mt-1.5 space-y-1 list-disc pl-4">
              <li>
                <span className="font-medium text-heading">iPhone:</span> Settings → Calendar → Accounts → Add Account → Other → Add Subscribed
                Calendar, then paste.
              </li>
              <li>
                <span className="font-medium text-heading">Android / Google:</span> on a computer, calendar.google.com → Other calendars → From URL,
                then paste.
              </li>
              <li>
                <span className="font-medium text-heading">Outlook:</span> Add calendar → Subscribe from web, then paste.
              </li>
            </ul>
          </details>

          <div className="border-t border-line pt-3">
            <p className="text-[11px] text-muted mb-2">
              Anyone with this address can see your inspection dates. If it ends up somewhere it shouldn&rsquo;t, replace it — the old one stops
              working straight away, and you re-add the new one on your phone.
            </p>
            <form action={formAction}>
              <input type="hidden" name="certifier_id" value={certifierId} />
              <button
                disabled={pending}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-error hover:underline disabled:opacity-60"
              >
                <RefreshCw size={12} /> {pending ? "Replacing…" : "Replace this address"}
              </button>
            </form>
            {state?.error && <div className="text-[11px] text-error mt-1">{state.error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
