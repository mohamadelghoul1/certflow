import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrl } from "@/lib/storage";
import { formatISODate, resolvePathwayCertRef } from "@/lib/business";
import { currentDocuments } from "@/lib/checklistDocuments";
import { ARCHIVE_SECTIONS, approvedDocumentFile, certificateFolder, inspectionFolder, jobFolder, photoFileName } from "@/lib/archive/archivePaths";
import { planUploads, type SyncCandidate } from "@/lib/backup/syncPlan";
import { providerFor } from "@/lib/backup/providers";
import { usableAccessToken, type Connection } from "@/lib/backup/connection";
import type { ChecklistItem, ChecklistItemFile, Inspection, InspectionPhoto, Job } from "@/types/db";

// Copying a job's files up to the firm's own cloud storage.
//
// The same folders as the downloadable archive — a firm that has been
// backing up for a year and then downloads an archive should find the
// folders it already knows — but not the same contents. The archive is
// the compliance record and keeps every version of every document,
// because the superseded ones are what show the set a certificate was
// actually assessed against. This is the firm's working filing, and holds
// one file per document: the approved one. The history stays in Certlyn
// and in the archive download for the day it is needed.
//
// lib/archive/archivePaths.ts is the single answer to where anything
// belongs.

export type SyncResult = { uploaded: number; skipped: number; failed: { path: string; reason: string }[] };

type ItemWithFiles = ChecklistItem & { checklist_item_files?: ChecklistItemFile[] | null };
type InspectionWithPhotos = Inspection & { inspection_photos?: InspectionPhoto[] | null };

// Everything on a job that belongs in the backup, and where each piece
// goes. Generated documents are not included: they are rebuilt on demand
// and the archive download is where they belong.
export function candidatesForJob(job: Job, items: ItemWithFiles[], inspections: InspectionWithPhotos[]): SyncCandidate[] {
  const candidates: SyncCandidate[] = [];

  if (job.pathway_approval_file_path) {
    const extension = job.pathway_approval_file_path.includes(".") ? job.pathway_approval_file_path.slice(job.pathway_approval_file_path.lastIndexOf(".")) : "";
    candidates.push({ storagePath: job.pathway_approval_file_path, folder: certificateFolder(job.pathway), fileName: `Signed approval (uploaded)${extension}` });
  }

  // Only what was approved, and only the copy that was approved. A
  // superseded draft and a document still waiting on a decision are both
  // working papers, not the firm's record of what it relied on — filing
  // them here is how a folder ends up with four plans in it and no way
  // to tell which one the certificate was issued against.
  //
  // Numbered by position in the whole checklist rather than among the
  // approved ones, so a document keeps its Schedule 1 number even when
  // the item above it has not been approved yet.
  items.forEach((item, index) => {
    if (item.status !== "approved") return;
    const docs = currentDocuments(item);
    for (const doc of docs) {
      if (!doc.filePath) continue;
      candidates.push({
        storagePath: doc.filePath,
        folder: ARCHIVE_SECTIONS.documents,
        fileName: approvedDocumentFile(index + 1, item.title, doc.filePath, doc.label, doc.documentNo, docs.length > 1),
      });
    }
  });

  inspections.forEach((inspection, index) => {
    const folder = inspectionFolder(index + 1, inspection.title, inspection.date ? formatISODate(inspection.date) : null);
    // The report Certlyn built and stored the moment it was signed. It
    // was missing from the backup entirely: a firm filing its
    // inspections got the photographs and nothing that said what the
    // certifier found.
    if (inspection.report_pdf_path) {
      candidates.push({ storagePath: inspection.report_pdf_path, folder, fileName: "Inspection report (signed).pdf" });
    }
    if (inspection.report_file_path) {
      const extension = inspection.report_file_path.includes(".") ? inspection.report_file_path.slice(inspection.report_file_path.lastIndexOf(".")) : "";
      candidates.push({ storagePath: inspection.report_file_path, folder, fileName: `Inspection report${extension}` });
    }
    (inspection.inspection_photos || []).forEach((photo, i) => {
      candidates.push({ storagePath: photo.file_path, folder, fileName: photoFileName(i + 1, photo.file_path, photo.caption || "") });
    });
  });

  return candidates;
}

// Documents this job generates rather than stores: the approved set and
// each Occupation Certificate set. Supplied by the caller because
// building them needs the signed-in certifier's own session, which a
// background sweep does not have — so a run without them still copies
// every stored file, and a run with them copies the finished sets too.
export type GeneratedDocument = { folder: string; fileName: string; marker: string; build: () => Promise<Uint8Array | null> };

export async function syncJob(connection: Connection, jobId: string, generated: GeneratedDocument[] = []): Promise<SyncResult> {
  const provider = providerFor(connection.provider);
  if (!provider) throw new Error("Unknown backup provider.");

  const admin = createAdminClient();
  const [{ data: rawJob }, { data: checklists }, { data: inspections }, { data: versions }, { data: uploaded }] = await Promise.all([
    admin.from("jobs").select("*").eq("id", jobId).eq("firm_id", connection.firm_id).single(),
    admin.from("checklists").select("id, checklist_items(*, checklist_item_files(*))").eq("job_id", jobId).order("sort_order", { referencedTable: "checklist_items" }),
    admin.from("inspections").select("*, inspection_photos(*)").eq("job_id", jobId).order("created_at"),
    admin.from("pathway_certificate_versions").select("version, cert_ref").eq("job_id", jobId),
    admin.from("cloud_backup_files").select("storage_path").eq("connection_id", connection.id).eq("job_id", jobId),
  ]);

  if (!rawJob) throw new Error("Project not found.");
  const job = rawJob as Job;
  const d = job.details || {};
  const projRef = d.projectNumber || job.id.slice(0, 8);
  const activeVersion = (versions || []).find((v) => v.version === job.pathway_version);
  const folder = jobFolder(resolvePathwayCertRef(activeVersion?.cert_ref, job.pathway, projRef, job.pathway_version), job.address || "");

  const items = (checklists || []).flatMap((c) => ((c.checklist_items as never[]) || []) as ItemWithFiles[]);
  const candidates = [
    ...candidatesForJob(job, items, (inspections || []) as InspectionWithPhotos[]),
    ...generated.map((doc) => ({ storagePath: null, folder: doc.folder, fileName: doc.fileName, marker: doc.marker, generate: doc.build })),
  ];
  const plan = planUploads(candidates, uploaded || [], connection.root_folder, folder);

  const accessToken = await usableAccessToken(connection);
  const result: SyncResult = { uploaded: 0, skipped: (uploaded || []).length, failed: [] };

  // One at a time rather than all at once: a firm's cloud storage will
  // rate-limit a burst, and a backup that trips a limit is a backup that
  // silently stops halfway.
  for (const upload of plan) {
    try {
      // Typed as its own buffer so it can be handed straight to fetch.
      let bytes: Uint8Array<ArrayBuffer>;
      if (upload.storagePath) {
        const url = await signedUrl(upload.storagePath);
        if (!url) throw new Error("the file could not be read from storage");
        const file = await fetch(url);
        if (!file.ok) throw new Error(`the file could not be read (${file.status})`);
        bytes = new Uint8Array(await file.arrayBuffer());
      } else {
        // Built only now, because the plan has decided it is going up.
        const built = await upload.generate?.();
        if (!built) throw new Error("the document could not be generated");
        bytes = new Uint8Array(built);
      }

      if (bytes.byteLength > provider.simpleUploadLimit) {
        throw new Error(`larger than ${provider.label} accepts in one piece (${Math.round(bytes.byteLength / 1024 / 1024)} MB)`);
      }

      const request = provider.uploadRequest({ accessToken, remotePath: upload.remotePath, size: bytes.byteLength });
      const res = await fetch(request.url, { method: request.method, headers: request.headers, body: bytes });
      if (!res.ok) throw new Error(`${provider.label} refused it (${res.status}) ${await res.text()}`.slice(0, 300));

      // Recorded only once it is actually up there, so a run that fails
      // halfway resumes rather than skipping what it never sent.
      await admin.from("cloud_backup_files").insert({
        connection_id: connection.id,
        job_id: jobId,
        storage_path: upload.key,
        remote_path: upload.remotePath,
        bytes: bytes.byteLength,
      });
      result.uploaded += 1;
    } catch (error) {
      result.failed.push({ path: upload.remotePath, reason: error instanceof Error ? error.message : "unknown error" });
    }
  }

  await admin
    .from("cloud_backup_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: result.failed.length ? `${result.failed.length} file${result.failed.length === 1 ? "" : "s"} could not be copied: ${result.failed[0].reason}` : null,
    })
    .eq("id", connection.id);

  return result;
}
