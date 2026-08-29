import { safeFileName } from "@/lib/downloadName";

// Where each file sits inside a job's archive.
//
// The archive is the firm's own copy of a job — the thing that outlives
// any subscription, and that a certifier is required to hold for years
// after the work is finished. So it is laid out to be read by a person
// opening a folder years later with no software at all: numbered
// sections in the order the job happened, documents under the name the
// certifier gave them, versions kept side by side.

// Folder and file names come from data a certifier typed, which routinely
// contains slashes, colons and quotes. Windows refuses several of those
// outright, so every segment is cleaned the same way a download name is,
// then trimmed of the trailing dots and spaces Windows also rejects.
export function archiveSegment(value: string, fallback = "Untitled") {
  const cleaned = safeFileName(value).replace(/[.\s]+$/, "").trim();
  return cleaned || fallback;
}

// A certificate reference carries the version it belongs to —
// "CDC-26280/01" — but a job is one folder, not one per version. A
// re-issued certificate belongs beside the first, in the same folder for
// the same site, which is also how a certifier's own filing already
// reads: "CDC-26280 - 28 Eucalyptus Street".
export function jobFolderRef(reference: string) {
  const trimmed = (reference || "").trim();
  return trimmed.replace(/\/\s*\d+\s*$/, "").trim() || trimmed;
}

export function jobFolder(reference: string, address: string) {
  const parts = [jobFolderRef(reference), address.trim()].filter(Boolean);
  return archiveSegment(parts.join(" - "), "Job");
}

// The layout a certifier's own filing already uses: everything for a job
// under one Documents folder, in named sections rather than numbered
// ones. A folder Certlyn files and a folder filed by hand open the same
// way, which is the whole point of a backup you can read without us.
export const ARCHIVE_ROOT = "Documents";

// A Fire Safety folder sits alongside these in a certifier's own filing.
// Nothing in Certlyn belongs there yet, and a folder is only created by
// putting a file in it, so it is simply absent rather than empty — the
// one filed by hand is untouched.
export const ARCHIVE_SECTIONS = {
  documents: `${ARCHIVE_ROOT}/Document Sets`,
  inspections: `${ARCHIVE_ROOT}/Inspections`,
  neighbours: `${ARCHIVE_ROOT}/Notice to Neighbours`,
  oc: `${ARCHIVE_ROOT}/Occupation Certificate`,
} as const;

// The certificate this firm issued, under its own name. A PC/OC job
// issues no certificate of ours — what sits here is the approval another
// certifier issued, so calling it a Complying Development Certificate
// would misfile someone else's document under our own heading.
export function certificateFolder(pathway: string) {
  const name = pathway === "CC" ? "Construction Certificate" : pathway === "PC_OC" ? "Approval" : "Complying Development Certificate";
  return `${ARCHIVE_ROOT}/${name}`;
}

// One folder per checklist item, numbered in the certifier's own order so
// the archive matches Schedule 1 rather than an alphabetical shuffle.
export function documentFolder(position: number, title: string) {
  return `${ARCHIVE_SECTIONS.documents}/${String(position).padStart(2, "0")} ${archiveSegment(title, "Document")}`;
}

// Versions sit together under the document they belong to, newest last,
// with the one in force marked so it is obvious which was relied on.
export function versionFileName(version: number, isCurrent: boolean, originalPath: string) {
  const extension = originalPath.includes(".") ? originalPath.slice(originalPath.lastIndexOf(".")) : "";
  const base = `v${version}${isCurrent ? " (current)" : ""}`;
  return `${base}${extension}`;
}

// What a document is called in the firm's cloud copy.
//
// The copy holds one file per document — the approved one — so there is
// nothing for a folder-per-document to separate. The file sits straight
// in Document Sets under the item's own name, numbered in the certifier's
// Schedule 1 order, which is what a person opening the folder is looking
// for.
//
// An item carrying more than one document still needs each of them told
// apart, so those take the label the certifier gave them, or their
// document number when they have no label.
export function approvedDocumentFile(position: number, title: string, originalPath: string, label = "", documentNo = 1, ofMany = false) {
  const extension = originalPath.includes(".") ? originalPath.slice(originalPath.lastIndexOf(".")) : "";
  const suffix = ofMany ? ` - ${archiveSegment(label, `Document ${documentNo}`)}` : "";
  return `${String(position).padStart(2, "0")} ${archiveSegment(title, "Document")}${suffix}${extension}`;
}

export function inspectionFolder(position: number, title: string, date: string | null) {
  const dated = date ? `${archiveSegment(title, "Inspection")} - ${date}` : archiveSegment(title, "Inspection");
  return `${ARCHIVE_SECTIONS.inspections}/${String(position).padStart(2, "0")} ${dated}`;
}

// A name that can't collide with another photo in the same inspection,
// even when two arrive from a phone with the same name.
export function photoFileName(position: number, originalPath: string, caption: string) {
  const extension = originalPath.includes(".") ? originalPath.slice(originalPath.lastIndexOf(".")) : ".jpg";
  const label = caption.trim() ? ` ${archiveSegment(caption, "")}` : "";
  return `${String(position).padStart(2, "0")}${label}${extension}`;
}
