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
  const router = useRouter();

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
      const { error: rpcError } = await supabase.rpc("client_submit_document", { p_item_id: itemId, p_file_path: path, p_document_no: documentNo ?? null });
      if (rpcError) throw rpcError;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer">
        <UploadCloud size={14} />
        {busy ? "Uploading…" : label || (hasFile ? "Upload a new version" : "Upload document")}
        <input type="file" className="hidden" onChange={handleChange} disabled={busy} />
      </label>
      {error && <div className="text-xs text-error mt-1">{error}</div>}
    </div>
  );
}
