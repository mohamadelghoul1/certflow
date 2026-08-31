"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UploadCloud } from "lucide-react";

// The storage half of an upload, shared with anything else that takes a
// dropped file — the whole checklist item card, say — so a file lands in
// exactly the same place however it arrives.
export async function uploadToStorage(pathPrefix: string, file: File): Promise<string> {
  const supabase = createClient();
  const path = `${pathPrefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("certflow-files").upload(path, file);
  if (error) throw error;
  return path;
}

export function FileUpload({
  pathPrefix,
  onUploaded,
  onStart,
  onFailed,
  label = "Upload file",
}: {
  pathPrefix: string;
  onUploaded: (path: string) => Promise<void> | void;
  // Fired the moment a file is chosen, before the transfer begins, so the
  // surrounding card can react straight away rather than sitting still
  // until the whole thing finishes.
  onStart?: () => void;
  // Undoes whatever onStart showed, when the transfer doesn't complete.
  onFailed?: () => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined | null) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    onStart?.();
    try {
      await onUploaded(await uploadToStorage(pathPrefix, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      onFailed?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* The button is also a drop target: a file dragged from the
          desktop can be let go on it instead of hunted for in the
          picker. The highlight answers "can I drop this here?" before
          the finger leaves the mouse button. */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`inline-flex items-center gap-1.5 text-sm font-medium border rounded-full px-4 py-1.5 cursor-pointer whitespace-nowrap ${
          dragOver ? "border-icon border-dashed bg-info-bg text-secondary" : "border-line text-muted hover:bg-hover"
        }`}
      >
        <UploadCloud size={14} />
        {busy ? "Uploading…" : dragOver ? "Drop to upload" : label}
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
