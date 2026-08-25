import JSZip from "jszip";
import { formatISODate } from "@/lib/business";
import { currentDocuments, versionsOf } from "@/lib/checklistDocuments";
import { ARCHIVE_SECTIONS, documentFolder, inspectionFolder, photoFileName, versionFileName } from "@/lib/archive/archivePaths";
import type { ChecklistItem, ChecklistItemFile, Defect, Inspection, InspectionPhoto, Job } from "@/types/db";

// A job's complete archive: everything the firm holds for it, in one zip.
//
// This is the copy that outlives the software. A certifier has to keep
// these records for years — longer than any subscription — and "can I get
// my data out?" is the first question anyone asks before trusting a
// system with it. Everything here is a real file: the documents the
// client sent, every earlier version of them, the inspection photos, the
// signed approval, and a plain-text summary so the job's own details are
// readable without the app.

export type ArchiveItem = ChecklistItem & { checklist_item_files?: ChecklistItemFile[] | null };
export type ArchiveInspection = Inspection & { defects?: Defect[] | null; inspection_photos?: InspectionPhoto[] | null };

export type ArchiveInput = {
  job: Job;
  reference: string;
  firmName: string;
  items: ArchiveItem[];
  inspections: ArchiveInspection[];
  // The signed approval as it was issued — the definitive record, rather
  // than one regenerated later from data that may since have changed.
  approval?: { name: string; bytes: Uint8Array } | null;
  // Fetches a stored file. Returns null for anything unreadable, which is
  // recorded in the summary rather than failing the whole archive.
  fetchFile: (path: string) => Promise<Uint8Array | null>;
};

export async function buildJobArchive(input: ArchiveInput): Promise<Uint8Array> {
  const zip = new JSZip();
  const missing: string[] = [];

  const add = async (path: string, storagePath: string | null | undefined) => {
    if (!storagePath) return false;
    const bytes = await input.fetchFile(storagePath);
    if (!bytes) {
      missing.push(path);
      return false;
    }
    zip.file(path, bytes);
    return true;
  };

  if (input.approval) zip.file(`${ARCHIVE_SECTIONS.approval}/${input.approval.name}`, input.approval.bytes);
  await add(`${ARCHIVE_SECTIONS.approval}/Signed approval (uploaded)${extensionOf(input.job.pathway_approval_file_path)}`, input.job.pathway_approval_file_path);

  // Documents, in the certifier's own order, every version of each kept.
  // The earlier versions are the point: they are what shows the set a
  // certificate was actually assessed against.
  for (const [index, item] of input.items.entries()) {
    const folder = documentFolder(index + 1, item.title);
    const docs = currentDocuments(item);

    for (const doc of docs) {
      const versions = versionsOf(item, doc.documentNo);
      const target = docs.length > 1 ? `${folder}/Document ${doc.documentNo}${doc.label ? ` - ${doc.label}` : ""}` : folder;

      if (versions.length === 0) {
        await add(`${target}/${versionFileName(1, true, doc.filePath || "")}`, doc.filePath);
        continue;
      }
      for (const version of versions) {
        await add(`${target}/${versionFileName(version.version, version.is_current !== false && version.file_path === doc.filePath, version.file_path)}`, version.file_path);
      }
    }
  }

  for (const [index, inspection] of input.inspections.entries()) {
    const folder = inspectionFolder(index + 1, inspection.title, inspection.date ? formatISODate(inspection.date) : null);
    await add(`${folder}/Inspection report${extensionOf(inspection.report_file_path)}`, inspection.report_file_path);
    for (const [i, photo] of (inspection.inspection_photos || []).entries()) {
      await add(`${folder}/${photoFileName(i + 1, photo.file_path, photo.caption || "")}`, photo.file_path);
    }
  }

  zip.file("job-summary.txt", jobSummary(input, missing));

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

function extensionOf(path: string | null | undefined) {
  if (!path || !path.includes(".")) return "";
  return path.slice(path.lastIndexOf("."));
}

// The job's own details as readable text, so the archive is a record on
// its own rather than a pile of files whose context lives in a database
// somebody may no longer have.
export function jobSummary(input: ArchiveInput, missing: string[] = []) {
  const { job, reference, firmName, items, inspections } = input;
  const d = job.details || {};
  const lines: string[] = [];
  const line = (label: string, value?: string | null) => lines.push(`${label}: ${value || "—"}`);

  lines.push(`${firmName} — job archive`, "");
  line("Reference", reference);
  line("Address", job.address);
  line("Pathway", job.pathway);
  line("Description", job.description);
  line("Lot / DP", d.certificateDetails?.lotSectionDp);
  line("Local Government Area", d.council?.lga);
  line("Land use zoning", d.zoning);
  line("Site sensitivities", (d.siteSensitivities || []).join(", "));
  line("NSW Planning Portal reference", d.certificateDetails?.planningPortalRef);
  line("Determination date", d.certificateDetails?.determinationDate ? formatISODate(d.certificateDetails.determinationDate) : null);
  line("Archived", formatISODate(new Date().toISOString().slice(0, 10)));

  lines.push("", "DOCUMENTS", "");
  items.forEach((item, i) => {
    const docs = currentDocuments(item);
    lines.push(`${String(i + 1).padStart(2, "0")}. ${item.title} — ${item.status}${docs.length > 1 ? ` (${docs.length} documents)` : ""}`);
    docs.forEach((doc) => {
      const versions = versionsOf(item, doc.documentNo).length;
      lines.push(`      prepared by ${doc.preparedBy || "—"} · ref ${doc.drawingNumber || "—"} · rev ${doc.revision || "—"} · ${doc.documentDate ? formatISODate(doc.documentDate) : "—"}${versions > 1 ? ` · ${versions} versions` : ""}`);
    });
  });

  lines.push("", "INSPECTIONS", "");
  inspections.forEach((inspection, i) => {
    lines.push(`${String(i + 1).padStart(2, "0")}. ${inspection.title} — ${inspection.outcome}${inspection.date ? ` on ${formatISODate(inspection.date)}` : ""}`);
    (inspection.defects || []).forEach((defect) => lines.push(`      issue: ${defect.text}`));
  });

  // Named rather than left out silently: an archive that quietly omits a
  // file is worse than one that says which file it could not read.
  if (missing.length > 0) {
    lines.push("", "COULD NOT BE INCLUDED", "", "These files are recorded against the job but could not be read from storage:", "");
    missing.forEach((m) => lines.push(`  ${m}`));
  }

  return lines.join("\n");
}
