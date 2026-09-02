"use client";

import { useActionState, useState } from "react";
import { ScrollText } from "lucide-react";
import { setJobConditionSets } from "@/lib/actions/cdcConditions";
import { SaveButton } from "@/components/certifier/SaveButton";
import type { ActionState } from "@/lib/actions/auth";
import type { CdcConditionSet } from "@/types/db";

// Which standard conditions this CDC is issued subject to.
//
// Tick boxes rather than a dropdown because a development can need more
// than one — a dwelling and the demolition that precedes it are two
// separate sets in the Regulation, and picking one would quietly leave
// the other off the approval.
//
// CDC only. A Construction Certificate is issued against a development
// consent whose conditions are the council's, and an Occupation
// Certificate grants occupation rather than imposing conditions of its
// own, so neither has anything to pick here.
export function JobCdcConditions({ jobId, sets, chosen }: { jobId: string; sets: CdcConditionSet[]; chosen: string[] }) {
  const [state, save, pending] = useActionState<ActionState, FormData>(setJobConditionSets, undefined);
  const [picked, setPicked] = useState<string[]>(chosen);

  function toggle(id: string, on: boolean) {
    setPicked((current) => (on ? [...current, id] : current.filter((c) => c !== id)));
  }

  return (
    <form action={save} className="border border-line rounded-xl p-6 shadow-sm bg-white">
      <input type="hidden" name="job_id" value={jobId} />
      <div className="flex items-center gap-2 mb-1">
        <ScrollText size={16} className="text-icon" />
        <div className="text-base font-semibold text-heading">Conditions of this CDC</div>
      </div>
      <p className="text-xs text-muted mb-3">
        Which standard conditions this development is approved subject to. Tick as many as apply — they are attached to the approved set behind the
        certificate, and named on it.
      </p>

      {sets.length === 0 ? (
        <p className="text-xs text-warning-text">
          No condition sets have been set up yet. Add them once under <span className="font-semibold">Settings &rarr; CDC conditions</span>, then they
          can be picked here on every project.
        </p>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {sets.map((set) => (
              <label key={set.id} className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm text-heading leading-snug cursor-pointer">
                <input
                  type="checkbox"
                  name="set_id"
                  value={set.id}
                  checked={picked.includes(set.id)}
                  onChange={(e) => toggle(set.id, e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-icon shrink-0"
                />
                <span>
                  {set.name}
                  {!set.file_path && <span className="block text-[11px] text-warning-text">No PDF uploaded — nothing will be attached for this one</span>}
                </span>
              </label>
            ))}
          </div>
          <SaveButton pending={pending} savedAt={state?.savedAt}>
            Save conditions
          </SaveButton>
          {state?.error && <p className="text-xs text-error mt-2">{state.error}</p>}
        </>
      )}
    </form>
  );
}
