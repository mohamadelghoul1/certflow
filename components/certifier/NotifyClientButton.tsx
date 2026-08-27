"use client";

import { useActionState } from "react";
import type { NotifyState } from "@/lib/actions/jobs";

// The "Notify client" buttons used to give no sign they'd been pressed —
// the email went (or quietly didn't) and the button just sat there. This
// one says what it's doing and what happened: Sending…, then a green
// confirmation or the red reason it couldn't send.
export function NotifyClientButton({
  action,
  fields,
  label,
}: {
  action: (prev: NotifyState, formData: FormData) => Promise<NotifyState>;
  fields: Record<string, string>;
  label: string;
}) {
  const [state, formAction, pending] = useActionState<NotifyState, FormData>(action, undefined);

  return (
    <form action={formAction} className="shrink-0">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button disabled={pending} className="text-xs font-semibold text-secondary hover:underline whitespace-nowrap disabled:opacity-60">
        {pending ? "Sending…" : state?.success ? "Send again" : label}
      </button>
      {!pending && state?.success && <div className="text-[11px] text-success mt-0.5">✓ {state.success}</div>}
      {!pending && state?.error && <div className="text-[11px] text-error mt-0.5 max-w-[220px]">{state.error}</div>}
    </form>
  );
}
