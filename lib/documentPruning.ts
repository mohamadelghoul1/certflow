import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAuditEvent } from "@/lib/audit";

// Clearing out superseded copies once a stage is finished.
//
// A document revised three times leaves four files in storage, and only
// the last one is ever used again: the approved set, Schedule 1 and the
// portal all read the current version. Once the stage's certificate is
// issued the earlier drafts are dead weight, so they go.
//
// Deliberately narrow about what "superseded" means. Only rows the
// database has already marked as not current are touched, and only when
// no current row — and no checklist item — still points at the same
// file. The version in use is never deleted, other stages are never
// touched, and certificates are not touched at all.
//
// Every run is written to the audit log, so a firm can see what left
// and when.

export type PruneResult = { files: number; items: number };

export async function pruneSupersededVersions(
  admin: SupabaseClient,
  { jobId, kind, firmId, jobAddress }: { jobId: string; kind: "pathway" | "noc" | "oc"; firmId: string | null; jobAddress?: string | null }
): Promise<PruneResult> {
  const { data: checklist } = await admin.from("checklists").select("id").eq("job_id", jobId).eq("kind", kind).maybeSingle();
  if (!checklist) return { files: 0, items: 0 };

  const { data: items } = await admin
    .from("checklist_items")
    .select("id, file_path, checklist_item_files(id, file_path, is_current)")
    .eq("checklist_id", checklist.id);
  if (!items || items.length === 0) return { files: 0, items: 0 };

  type FileRow = { id: string; file_path: string | null; is_current: boolean | null };

  // Everything still in use, whichever way it is referenced.
  const keep = new Set<string>();
  for (const item of items) {
    if (item.file_path) keep.add(item.file_path);
    for (const f of (item.checklist_item_files as FileRow[]) || []) {
      if (f.is_current && f.file_path) keep.add(f.file_path);
    }
  }

  const doomed: { id: string; path: string }[] = [];
  const touched = new Set<string>();
  for (const item of items) {
    for (const f of (item.checklist_item_files as FileRow[]) || []) {
      if (f.is_current || !f.file_path || keep.has(f.file_path)) continue;
      doomed.push({ id: f.id, path: f.file_path });
      touched.add(item.id);
    }
  }
  if (doomed.length === 0) return { files: 0, items: 0 };

  // The files first: a row deleted before its file would leave the file
  // orphaned in storage with nothing left pointing at it.
  const { error: storageError } = await admin.storage.from("certflow-files").remove(doomed.map((d) => d.path));
  if (storageError) return { files: 0, items: 0 };

  const { error: rowError } = await admin
    .from("checklist_item_files")
    .delete()
    .in(
      "id",
      doomed.map((d) => d.id)
    );
  if (rowError) return { files: 0, items: 0 };

  if (firmId) {
    const label = kind === "pathway" ? "the approval" : kind === "noc" ? "the Notice of Commencement" : "the Occupation Certificate";
    await recordAuditEvent(admin, {
      firmId,
      action: "documents.pruned",
      summary: `Cleared ${doomed.length} superseded document version${doomed.length === 1 ? "" : "s"} after ${label} was issued`,
      jobId,
      jobAddress: jobAddress ?? null,
      detail: { kind, files: doomed.length, items: touched.size },
    });
  }

  return { files: doomed.length, items: touched.size };
}
