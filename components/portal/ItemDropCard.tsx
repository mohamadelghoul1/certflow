"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitClientDocument } from "@/lib/actions/portal";
import { UploadCloud } from "lucide-react";
import { uploadProblem } from "@/lib/uploads";

// The whole checklist-item card as a drop target, not just the little
// upload link inside it — dragging a file "onto the item" is what people
// actually try first. Where the drop should land is decided by the
// server when it renders the card: the first document when none exists,
// a new version when there is exactly one. With two documents the card
// stays neutral (enabled=false) — guessing which one a dropped file
// replaces would be worse than asking the client to use the button next
// to the right one.
export function ItemDropCard({
  itemId,
  pathPrefix,
  documentNo,
  enabled,
  label,
  className,
  children,
}: {
  itemId: string;
  pathPrefix: string;
  documentNo: number | null;
  enabled: boolean;
  label: string;
  className: string;
  children: ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // "Uploading…" holds through the page refresh too — see the note in
  // UploadClientDocument.
  const [refreshing, startRefresh] = useTransition();
  const working = busy || refreshing;
  const router = useRouter();

  async function handleFile(file: File | undefined | null) {
    if (!file || working) return;
    // Checked here so the person is told plainly and before the file
    // leaves their phone. The database refuses the same thing anyway —
    // this upload goes straight from the browser to storage, so what is
    // written here is a courtesy, not the control.
    const problem = uploadProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const path = `${pathPrefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("certflow-files").upload(path, file);
      if (uploadError) throw uploadError;
      const { error: submitError } = await submitClientDocument({ itemId, filePath: path, documentNo, fileName: file.name });
      if (submitError) throw new Error(submitError);
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <div className={className}>{children}</div>;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        // Moving between the card's own children fires leave events too;
        // only a move truly outside the card ends the highlight.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFile(e.dataTransfer.files?.[0]);
      }}
      className={`relative ${className} ${dragOver ? "ring-2 ring-icon" : ""}`}
    >
      {children}
      {dragOver && (
        <div className="absolute inset-0 rounded-md bg-info-bg/90 border-2 border-dashed border-icon flex items-center justify-center pointer-events-none">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary">
            <UploadCloud size={16} /> {label}
          </span>
        </div>
      )}
      {working && <div className="text-sm font-semibold text-secondary mt-2">Uploading…</div>}
      {error && <div className="text-xs text-error mt-2">{error}</div>}
    </div>
  );
}
