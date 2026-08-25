"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addPhoto } from "@/lib/actions/inspections";
import { MAX_INSPECTION_PHOTOS, photoSlotsRemaining } from "@/lib/constants";

// Photos for an inspection: several at once, up to the report's limit.
//
// The generic upload control takes one file at a time, which meant four
// separate trips through the file picker for a visit that produced four
// photos. This one accepts a whole selection, uploads them together, and
// stops at the number the report can carry.

export function InspectionPhotoUpload({ inspectionId, jobId, pathPrefix, existing }: { inspectionId: string; jobId: string; pathPrefix: string; existing: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remaining = photoSlotsRemaining(existing);

  if (remaining === 0) {
    return <div className="text-[11px] text-muted">All {MAX_INSPECTION_PHOTOS} photos added. Remove one to add another.</div>;
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files || []);
    if (chosen.length === 0) return;

    // Anything past the limit is left behind rather than silently
    // uploaded and then refused by the server.
    const files = chosen.slice(0, remaining);
    const overflow = chosen.length - files.length;

    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      // Uploaded together — four photos one after another is four times
      // the wait for no reason.
      const paths = await Promise.all(
        files.map(async (file) => {
          const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { error: uploadError } = await supabase.storage.from("certflow-files").upload(path, file);
          if (uploadError) throw uploadError;
          return path;
        })
      );

      // Recorded one at a time and in order, so the photos appear on the
      // report in the order they were chosen.
      for (const path of paths) {
        const fd = new FormData();
        fd.set("inspection_id", inspectionId);
        fd.set("job_id", jobId);
        fd.set("file_path", path);
        await addPhoto(fd);
      }

      if (overflow > 0) setError(`Only ${MAX_INSPECTION_PHOTOS} photos fit on a report, so ${overflow === 1 ? "one was" : `${overflow} were`} left out.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <label className="inline-flex items-center gap-1.5 text-sm font-medium text-muted border border-line rounded-full px-4 py-1.5 hover:bg-hover cursor-pointer whitespace-nowrap">
        <UploadCloud size={14} />
        {busy ? "Uploading…" : remaining === MAX_INSPECTION_PHOTOS ? "Add photos" : `Add photos (${remaining} left)`}
        <input type="file" accept="image/*" multiple className="hidden" onChange={handleChange} disabled={busy} />
      </label>
      {error && <div className="text-xs text-error mt-1">{error}</div>}
    </div>
  );
}
