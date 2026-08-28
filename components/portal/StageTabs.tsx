"use client";

import { useState, type ReactNode } from "react";
import { Lock, Check } from "lucide-react";

// The three stage panels arrive fully rendered from the server; switching
// between them is just showing a different one, so it happens in the
// browser instantly instead of asking the server to rebuild the page.
export function StageTabs({
  tabs,
  initialStage,
  ocLocked,
  nocProgress,
  approval,
  noc,
  oc,
}: {
  tabs: { key: string; label: string; done: boolean; locked?: boolean }[];
  initialStage: string;
  ocLocked: boolean;
  // e.g. "2/5" — shown in the locked panel so the client can see how close
  // the Notice of Commencement is to opening the OC stage.
  nocProgress: string | null;
  approval: ReactNode;
  noc: ReactNode;
  oc: ReactNode;
}) {
  const [stage, setStage] = useState(initialStage);

  const show = (key: string) => {
    setStage(key);
    // Keep the address shareable and refresh-proof without navigating.
    window.history.replaceState(null, "", `?stage=${key}`);
  };

  return (
    <>
      {/* A stage the client has nothing left to do on goes green and
          wears a tick, whether or not it is the one being looked at — so
          progress through the job reads off the row itself rather than
          having to be opened one tab at a time. */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const selected = stage === t.key;
          const done = t.done && !t.locked;
          const tone = done
            ? selected
              ? "bg-success text-white border-success"
              : "bg-success-bg text-success border-success/40 hover:border-success"
            : selected
              ? "bg-primary text-white border-primary"
              : t.locked
                ? "bg-surface text-placeholder border-line border-dashed hover:border-placeholder"
                : "bg-white text-primary border-line hover:border-primary";

          return (
            <button
              key={t.key}
              type="button"
              onClick={() => show(t.key)}
              aria-current={selected ? "true" : undefined}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${tone}`}
            >
              {t.locked && <Lock size={13} />}
              {/* The tick sits in its own circle so it reads as a stamp on
                  the stage rather than a bullet beside its name. */}
              {done && (
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${selected ? "bg-white/25" : "bg-success"}`}>
                  <Check size={11} strokeWidth={3} className="text-white" />
                </span>
              )}
              {t.label}
            </button>
          );
        })}
      </div>

      {stage === "approval" && approval}
      {stage === "noc" && noc}
      {stage === "oc" &&
        (ocLocked ? (
          <div className="bg-white rounded-lg border border-line p-8 text-center">
            <Lock className="mx-auto text-placeholder" size={28} />
            <div className="font-bold text-primary mt-3">Occupation Certificate stage is locked</div>
            <div className="text-sm text-muted mt-1 max-w-md mx-auto">
              This stage opens once every item on the Notice of Commencement checklist has been approved
              {nocProgress ? ` (${nocProgress} approved so far)` : ""}.
            </div>
            <button type="button" onClick={() => show("noc")} className="inline-block mt-4 text-sm font-semibold text-primary hover:underline">
              Go to the Notice of Commencement →
            </button>
          </div>
        ) : (
          oc
        ))}
    </>
  );
}
