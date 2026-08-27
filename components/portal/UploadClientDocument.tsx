"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitClientDocument } from "@/lib/actions/portal";
import { UploadCloud } from "lucide-react";

// Uploading a document against a checklist item.
//
// `documentNo` says which document this replaces. Leaving it out adds
// another document alongside the ones already there — which is how a
// second certificate for the same item is sent, rather than overwriting
// the first.
export function UploadClientDocument({
  itemId,
  pathPrefix,
  hasFile,
  documentNo,
  label,
}: {
  itemId: string;
  pathPrefix: string;
  hasFile: boolean;
  documentNo?: number;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();

  async function handleFile(file: File | undefined | null) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const path = `${pathPrefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("certflow-files").upload(path, file);
      if (uploadError) throw uploadError;
      // Recorded through a server action rather than straight into the
      // database, so the certifier gets an email about the new document.
      const { error: submitError } = await submitClientDocument({ itemId, filePath: path, documentNo: documentNo ?? null, fileName: file.name });
      if (submitError) throw new Error(submitError);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Also a drop target — see FileUpload. Padded a little while a
          file hovers, so there is something to land on. */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          // Stopped here so the surrounding ItemDropCard doesn't light up
          // and catch the same drop — one file, one upload.
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer rounded-full px-3.5 py-1.5 border whitespace-nowrap ${
          dragOver ? "border-dashed border-icon bg-info-bg text-secondary" : "border-primary/50 text-primary bg-white hover:bg-surface"
        }`}
      >
        <UploadCloud size={14} />
        {busy ? "Uploading…" : dragOver ? "Drop to upload" : label || (hasFile ? "Upload a new version" : "Upload document")}
        <input
          type="file"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
          disabled={busy}
        />
      </label>
      {error && <div className="text-xs text-error mt-1">{error}</div>}
    </div>
  );
}
