"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { renameCertRef } from "@/lib/actions/jobs";

// Inline edit for a certificate's reference. Shows the reference as plain
// text with a pencil beside it; clicking swaps in an input. Submitting
// blank clears the override so the reference reverts to the generated
// {PATHWAY}-{project number}/{version} form — which is why the hint says
// "leave blank to reset" rather than the field simply being required.
export function EditableCertRef({ jobId, recordId, kind, currentRef, isCustom }: { jobId: string; recordId: string; kind: "pathway" | "oc"; currentRef: string; isCustom: boolean }) {
  const [editing, setEditing] = useState(false);
  const [optimisticRef, setOptimisticRef] = useOptimistic(currentRef);
  const [, startTransition] = useTransition();

  function save(value: string) {
    setEditing(false);
    startTransition(async () => {
      // Empty clears the override, but the generated reference it falls back
      // to is only known server-side, so show the typed value until the
      // server answers rather than guessing at it here.
      if (value.trim()) setOptimisticRef(value.trim());
      const fd = new FormData();
      fd.set("job_id", jobId);
      fd.set("record_id", recordId);
      fd.set("kind", kind);
      fd.set("cert_ref", value);
      await renameCertRef(fd);
    });
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(new FormData(e.currentTarget).get("cert_ref") as string);
        }}
        className="flex items-center gap-2 flex-wrap"
      >
        <input
          name="cert_ref"
          autoFocus
          defaultValue={isCustom ? currentRef : ""}
          placeholder={currentRef}
          className="px-2 py-1 rounded border border-line text-sm font-semibold min-w-0 flex-1"
        />
        <button type="submit" className="text-xs font-semibold text-secondary hover:underline shrink-0">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted hover:underline shrink-0">
          Cancel
        </button>
        <span className="text-[11px] text-muted basis-full">Leave blank to reset to the automatic reference.</span>
      </form>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {optimisticRef}
      <button type="button" onClick={() => setEditing(true)} aria-label="Rename this certificate reference" title="Rename reference" className="text-muted hover:text-secondary">
        <Pencil size={12} />
      </button>
    </span>
  );
}
