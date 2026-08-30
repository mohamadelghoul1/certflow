"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

// A save button that says what happened.
//
// These forms used to return nothing at all on success: the button read
// "Saving…" for however long the save took — often too briefly to see on
// a fast connection — and then went back to how it started. Pressing
// Save and being told nothing is indistinguishable from pressing Save
// and nothing happening, so the only way to know was to reload the page
// and look.
//
// The tick clears itself after a few seconds. A confirmation that stays
// on screen stops meaning "just now" and starts being furniture.
export function SaveButton({
  pending,
  savedAt,
  children,
  savingLabel = "Saving…",
  className = "px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60",
}: {
  pending: boolean;
  savedAt?: number;
  children: React.ReactNode;
  savingLabel?: string;
  className?: string;
}) {
  // Which save has already had its moment. Derived rather than mirrored:
  // the tick is on whenever the latest save is not the one already
  // retired, so nothing has to be switched on when a save lands — only
  // off, later, which is what the timer is for.
  const [retired, setRetired] = useState<number | undefined>(undefined);
  const showSaved = !!savedAt && retired !== savedAt;

  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setRetired(savedAt), 4000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <button disabled={pending} className={className}>
        {pending ? savingLabel : children}
      </button>
      {/* role="status" so a screen reader announces it without the
          focus being moved off the button. */}
      <span role="status" aria-live="polite" className={`flex items-center gap-1 text-sm text-accent transition-opacity ${showSaved ? "opacity-100" : "opacity-0"}`}>
        {showSaved && (
          <>
            <Check size={15} /> Saved
          </>
        )}
      </span>
    </div>
  );
}
