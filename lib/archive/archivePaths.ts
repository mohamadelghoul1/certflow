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

export function jobFolder(reference: string, address: string) {
  const parts = [reference.trim(), address.trim()].filter(Boolean);
  return archiveSegment(parts.join(" - "), "Job");
}

// Numbered so a file browser lists them in the order the job ran, rather
// than alphabetically — Approval before Documents before Inspections.
export const ARCHIVE_SECTIONS = {
  approval: "01 Approval",
  documents: "02 Documents",
  inspections: "03 Inspections",
  correspondence: "04 Correspondence",
} as const;

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
