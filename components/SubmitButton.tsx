"use client";

import { useFormStatus } from "react-dom";

// A button that shows it was pressed.
//
// A plain button inside a server-action form does nothing visible on the
// press: the browser sends the request and the page only changes when
// the server has finished and the new HTML has arrived. On a desk that
// is a blink. On a phone on site it is long enough to believe the press
// missed — so it gets pressed again, and the second press is a second
// request against a job that may already have changed.
//
// useFormStatus reports the state of the form this button sits inside,
// so nothing has to be wired up per form: dropped in place of <button>,
// it dims and stops accepting presses for exactly as long as the work
// takes.
//
// For forms that stay on the page afterwards, SaveButton says "Saved"
// as well. This is the smaller promise — that the press registered —
// and belongs on the buttons that navigate, delete, or replace what is
// on screen, where arriving somewhere new is the confirmation.
export function SubmitButton({
  children,
  className = "",
  pendingLabel,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...rest}
      disabled={pending || rest.disabled}
      aria-busy={pending || undefined}
      className={`${className} disabled:opacity-50 disabled:cursor-progress`.trim()}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
