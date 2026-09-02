"use client";

import { useActionState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { addConditionSet, removeConditionSet, setConditionSetFile } from "@/lib/actions/cdcConditions";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { SaveButton } from "@/components/certifier/SaveButton";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState, } from "@/lib/actions/auth";
import type { CdcConditionSet } from "@/types/db";

// The standard condition sets the firm issues CDCs under.
//
// The conditions are the department's words, not the firm's — nine to
// sixteen pages of the Regulation, different for a greenfield dwelling,
// a demolition, an alteration. So Certlyn holds the PDF and the name the
// firm knows it by, and never pretends to be where the words come from.
// Set up once here; picked per project on the CDC tab.
export function CdcConditionsSection({ sets, firmId, fileUrls }: { sets: CdcConditionSet[]; firmId: string; fileUrls: Record<string, string> }) {
  const [state, add, pending] = useActionState<ActionState, FormData>(addConditionSet, undefined);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        The standard conditions a CDC is issued subject to. Add each one you use, upload the department&rsquo;s PDF against it, and on a CDC project you
        pick which ones apply — as many as the development needs. They are attached to the approved set behind the certificate.
      </p>

      <div className="border border-line rounded-md divide-y divide-line">
        {sets.map((set) => (
          <div key={set.id} className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-primary">{set.name}</div>
              {fileUrls[set.id] ? (
                <a href={fileUrls[set.id]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-secondary hover:underline">
                  <FileText size={11} /> View the uploaded conditions
                </a>
              ) : (
                // Said plainly: a set with no file is a name that attaches
                // nothing, and that would be discovered at the worst
                // moment — when the approved set goes out without it.
                <span className="text-[11px] text-warning-text">No PDF uploaded yet — nothing will be attached until there is one</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ActionUpload
                action={setConditionSetFile}
                fields={{ id: set.id }}
                pathPrefix={`${firmId}/cdc-conditions/${set.id}`}
                label={set.file_path ? "Replace PDF" : "Upload PDF"}
              />
              <form action={removeConditionSet}>
                <input type="hidden" name="id" value={set.id} />
                <SubmitButton className="inline-flex items-center gap-1 text-xs text-error hover:underline">
                  <Trash2 size={12} /> Remove
                </SubmitButton>
              </form>
            </div>
          </div>
        ))}
        {sets.length === 0 && <div className="px-4 py-8 text-center text-sm text-placeholder">No condition sets yet. Add the first one below.</div>}
      </div>

      <form action={add} className="flex items-end gap-2 flex-wrap border border-line rounded-md p-4">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] text-placeholder mb-1">Name</label>
          <input name="name" required placeholder="e.g. Greenfield Housing Code — conditions" className="w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
        </div>
        <SaveButton pending={pending} savedAt={state?.savedAt} className="px-3.5 py-2 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700">
          Add condition set
        </SaveButton>
        {state?.error && <div className="text-xs text-error w-full">{state.error}</div>}
      </form>
    </div>
  );
}
