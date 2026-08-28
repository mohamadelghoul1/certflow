"use client";

import { useEffect, useRef, type RefObject } from "react";

// Editing that ends where the attention goes.
//
// A small editor with a Save button underneath asks for two actions when
// people only mean one: they type, then click away at whatever they
// wanted next, and the typing is lost — or worse, sits there looking
// saved. Pressing anywhere outside commits it instead.
//
// pointerdown rather than click or blur: blur never fires on a touch
// screen when the next thing touched isn't focusable, and click comes
// too late — the page may already have moved under the finger.
//
// The commit is guarded against firing twice, since the same press can
// reach both this and a button inside the editor.
export function useCommitOnOutsidePress(ref: RefObject<HTMLElement | null>, active: boolean, commit: () => void) {
  const committed = useRef(false);
  // Kept in a ref so re-renders while typing don't tear the listener
  // down and put it back on every keystroke.
  const latest = useRef(commit);
  useEffect(() => {
    latest.current = commit;
  });

  useEffect(() => {
    if (!active) {
      committed.current = false;
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const container = ref.current;
      if (!container || container.contains(event.target as Node)) return;
      if (committed.current) return;
      committed.current = true;
      latest.current();
    }
    // Escape is the way out without saving, and every editor that uses
    // this offers a Cancel too.
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [active, ref]);

  // So a Save or Cancel button inside the editor can mark the press as
  // already dealt with.
  return () => {
    committed.current = true;
  };
}
