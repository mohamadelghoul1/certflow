"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitApprovalCopy, removeApprovalCopy } from "@/lib/actions/portal";
import { UploadCloud, FileCheck2 } from "lucide-react";

export type ApprovalCopy = { id: string; fileName: string; sentOn: string; url: string | null };

// Sending your own copy of an issued certificate back to the certifier.
//
// The copy an owner ends up holding is often not the one the certifier
// has — council stamps and returns it, the Planning Portal endorses its
// own version, a builder scans the signed original. That copy used to
// travel by email and never reach the project it belongs to. It is filed
// beside the certificate, never over it: what the firm issued stays
// exactly as issued.
export function ApprovalCopyUpload({
  jobId,
  firmId,
  kind,
  ocRecordId = null,
  label,
  copies,
}: {
  jobId: string;
  firmId: string;
  kind: "pathway" | "oc";
  ocRecordId?: string | null;
  // What this is a copy of, in words: "the CDC certificate".
  label: string;
  copies: ApprovalCopy[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  // "Uploading…" holds through the page refresh too, so there is no gap
  // where the screen still shows the old state and the upload looks like
  // it went nowhere.
  const [refreshing, startRefresh] = useTransition();
  const working = busy || refreshing;
  const router = useRouter();

  async function handleFile(file: File | undefined | null) {
    if (!file || working) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const path = `${firmId}/${jobId}/client-approvals/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("certflow-files").upload(path, file);
      if (uploadError) throw uploadError;
      const { error: submitError } = await submitApprovalCopy({ jobId, kind, ocRecordId, filePath: path, fileName: file.name, label });
      if (submitError) throw new Error(submitError);
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (working) return;
    setBusy(true);
    setError("");
    try {
      const { error: removeError } = await removeApprovalCopy({ id });
      if (removeError) throw new Error(removeError);
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-line">
      <div className="text-xs text-placeholder mb-2">
        Have a stamped or signed copy of {label}? Send it to your certifier here — it is filed alongside their own copy.
      </div>

      {copies.length > 0 && (
        <div className="space-y-1 mb-2">
          {copies.map((copy) => (
            <div key={copy.id} className="flex items-center gap-2 text-xs text-muted flex-wrap">
              <FileCheck2 size={13} className="text-success shrink-0" />
              {copy.url ? (
                <a href={copy.url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
                  {copy.fileName}
                </a>
              ) : (
                <span className="font-semibold">{copy.fileName}</span>
              )}
              <span>· sent {copy.sentOn}</span>
              <button type="button" onClick={() => void remove(copy.id)} disabled={working} className="text-placeholder hover:text-error hover:underline disabled:opacity-50">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Also a drop target: dragging the file onto the button is what
          people try first. */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
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
        className={`inline-flex items-center gap-2 text-sm font-semibold cursor-pointer rounded-full px-5 py-2 border whitespace-nowrap ${
          dragOver ? "border-dashed border-icon bg-info-bg text-secondary" : "border-primary/50 text-primary bg-white hover:bg-surface"
        }`}
      >
        <UploadCloud size={16} />
        {working ? "Uploading…" : dragOver ? "Drop to upload" : copies.length > 0 ? "Upload another copy" : "Upload your copy"}
        <input
          type="file"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
          disabled={working}
        />
      </label>
      {error && <div className="text-xs text-error mt-1">{error}</div>}
    </div>
  );
}
