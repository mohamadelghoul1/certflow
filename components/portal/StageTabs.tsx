"use client";

import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";

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
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => show(t.key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-semibold border ${
              stage === t.key ? "bg-primary text-white border-primary" : "bg-white text-primary border-line hover:border-primary"
            }`}
          >
            {t.locked && <Lock size={13} />}
            {t.label}
            {t.done && !t.locked && <span className={`w-2 h-2 rounded-full ${stage === t.key ? "bg-white" : "bg-success"}`} />}
          </button>
        ))}
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
