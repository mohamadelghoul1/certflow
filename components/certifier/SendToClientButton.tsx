"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/auth";

// Shared by the CDC/CC and OC panels: the one-click "make this visible to
// the client" step, kept separate from signing so a mistake in a signed
// document can still be fixed (regenerate + re-sign) before the client
// ever sees it.
export function SendToClientButton({
  action,
  fields,
  disabled,
  disabledReason,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  return (
    <div className="flex items-center gap-2">
      <form action={formAction}>
        {Object.entries(fields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <button
          disabled={disabled || pending}
          title={disabled ? disabledReason : undefined}
          className="text-xs font-semibold text-white bg-success hover:bg-success px-3 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Sending…" : "Send to client"}
        </button>
      </form>
      {state?.error && <span className="text-xs text-error">{state.error}</span>}
    </div>
  );
}
