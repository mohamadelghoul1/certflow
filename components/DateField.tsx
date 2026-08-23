"use client";

import type { InputHTMLAttributes } from "react";

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

export function DateField({ onClick, onKeyDown, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
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
