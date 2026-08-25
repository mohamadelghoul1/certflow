"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { certifierUploadItem } from "@/lib/actions/jobs";

// Uploading a document against a checklist item on the client's behalf.
//
// A number replaces that document; "new" adds another alongside it, which
// is how an item comes to hold two certificates rather than one
// overwriting the other.
export function CertifierDocumentUpload({
  itemId,
  jobId,
  pathPrefix,
  documentNo,
  label,
}: {
  itemId: string;
  jobId: string;
  pathPrefix: string;
  documentNo: number | "new";
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const path = `${pathPrefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("certflow-files").upload(path, file);
      if (uploadError) throw uploadError;
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("job_id", jobId);
      fd.set("file_path", path);
      fd.set("document_no", String(documentNo));
      await certifierUploadItem(fd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col">
      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline cursor-pointer">
        <UploadCloud size={12} />
        {busy ? "Uploading…" : label}
        <input type="file" className="hidden" onChange={handleChange} disabled={busy} />
      </label>
      {error && <span className="text-[11px] text-error mt-1">{error}</span>}
    </span>
  );
}
