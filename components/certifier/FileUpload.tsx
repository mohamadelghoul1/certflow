"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UploadCloud } from "lucide-react";

export function FileUpload({
  pathPrefix,
  onUploaded,
  label = "Upload file",
}: {
  pathPrefix: string;
  onUploaded: (path: string) => Promise<void> | void;
  label?: string;
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
      await onUploaded(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:underline cursor-pointer">
        <UploadCloud size={14} />
        {busy ? "Uploading…" : label}
        <input type="file" className="hidden" onChange={handleChange} disabled={busy} />
      </label>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
