"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { setSiteSensitivities } from "@/lib/actions/jobs";
import { SITE_SENSITIVITIES } from "@/lib/constants";

// The constraints on the land, beside the address where they can't be
// missed: bushfire prone land pulls in AS 3959, a flood planning area
// changes floor levels, heritage can rule complying development out
// altogether. Buried on the Details tab they are read once at intake and
// never again.
//
// The suggestions are a shortcut, not a limit — anything can be typed,
// because no list of constraints covers every site.
export function SiteSensitivities({ jobId, sensitivities }: { jobId: string; sensitivities: string[] }) {
  const [optimistic, setOptimistic] = useOptimistic(sensitivities);
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  // Clicking anywhere else closes it, the way a menu does — there is
  // nothing to confirm, since each tick has already saved. Escape closes
  // it too, for anyone working from the keyboard.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function save(next: string[]) {
    startTransition(async () => {
      setOptimistic(next);
      const fd = new FormData();
      fd.set("job_id", jobId);
      next.forEach((v) => fd.append("sensitivity", v));
      await setSiteSensitivities(fd);
    });
  }

  const toggle = (value: string) => save(optimistic.includes(value) ? optimistic.filter((v) => v !== value) : [...optimistic, value]);

  function addTyped() {
    const trimmed = draft.trim();
    if (!trimmed || optimistic.includes(trimmed)) {
      setDraft("");
      return;
    }
    save([...optimistic, trimmed]);
    setDraft("");
  }

  return (
    <div className="relative" ref={panel}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {optimistic.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning-bg text-warning-text text-xs font-medium">
            <AlertTriangle size={11} /> {s}
            <button type="button" onClick={() => toggle(s)} title={`Remove ${s}`} className="hover:opacity-70">
              <X size={11} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-line text-xs text-muted hover:text-heading hover:border-muted"
        >
          <Plus size={11} /> {optimistic.length === 0 ? "Site sensitivities" : "Add"}
        </button>
      </div>

      {open && (
        <div className="absolute z-20 mt-2 w-72 rounded-xl border border-line bg-white shadow-lg p-3">
          <div className="text-xs font-semibold text-heading mb-2">Site sensitivities</div>
          <p className="text-[11px] text-muted mb-2">Each one saves as you tick it. Click anywhere else to close.</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SITE_SENSITIVITIES.map((s) => {
              const on = optimistic.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  className={`px-2 py-1 rounded-full text-[11px] font-medium border ${
                    on ? "bg-warning-bg text-warning-text border-warning-bg" : "border-line text-muted hover:border-muted hover:text-heading"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTyped();
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              // Clicking away keeps what was typed, the same way the
              // other boxes on a job do.
              onBlur={addTyped}
              placeholder="Anything else…"
              className="flex-1 px-2 py-1.5 rounded border border-line text-xs"
            />
            <button type="submit" className="text-xs font-semibold text-secondary hover:underline">
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
