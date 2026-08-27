"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
      const { error: rpcError } = await supabase.rpc("client_submit_document", { p_item_id: itemId, p_file_path: path, p_document_no: documentNo ?? null });
      if (rpcError) throw rpcError;
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
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
          dragOver ? "px-2 py-1 rounded-md border border-dashed border-icon bg-info-bg text-secondary" : "text-primary hover:underline"
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
