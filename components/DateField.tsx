"use client";

import type { InputHTMLAttributes, Ref } from "react";

// A date box that opens the calendar the moment you touch it.
//
// The browser's own date control puts the cursor in whichever of the
// day / month / year segments you happened to click and then waits for
// you to type — which reads like a text box, and leaves it easy to fill
// in one segment, look away, and leave the date half-entered. Clicking
// (or pressing Enter/Space on) any part of the box now opens the picker
// instead, so there's one way to set a date and it always ends up
// complete.
//
// showPicker() only exists in newer browsers and throws if the browser
// doesn't count the moment as a real user action, so both cases fall
// back to the plain control rather than breaking the field.
function openPicker(el: HTMLInputElement) {
  try {
    el.showPicker?.();
  } catch {
    // Older browser, or no user activation — the normal segment-typing
    // behaviour still works.
  }
}

// `noFuture` caps the box at today — for a date recording something that
// has already happened, like the day an inspection was carried out.
//
// Set on the element itself once it exists, rather than rendered as an
// attribute, because a client component is server-rendered first and the
// server's idea of today is UTC — a day ahead for most of a Sydney
// afternoon. Rendering that and correcting it in the browser would be a
// hydration mismatch; setting it only in the browser is not. The action
// that saves the date checks it again regardless.
export function DateField({ onClick, onKeyDown, noFuture, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { noFuture?: boolean; ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      {...props}
      ref={(el) => {
        if (el && noFuture) el.max = todayISO();
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      type="date"
      onClick={(e) => {
        openPicker(e.currentTarget);
        onClick?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker(e.currentTarget);
        }
        onKeyDown?.(e);
      }}
    />
  );
}

// Today in the browser's own timezone, as the yyyy-mm-dd a date input
// wants. Deliberately not toISOString(), which converts to UTC first and
// so reads as yesterday for most of the Australian working day.
export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
