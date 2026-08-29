import { remotePath } from "@/lib/backup/providers";

// What a backup run should send.
//
// Files in our own storage are written to a new timestamped path on every
// upload, so a path that has been copied up once is that file forever and
// never needs copying again. That makes a backup run cheap: it is the
// day's new paths, not every file the firm has ever held.
//
// Generated documents are the exception — the approved set is rebuilt
// each time and can genuinely change — so those carry an explicit marker
// and are sent when the marker changes.

export type SyncCandidate = {
  // The path in our storage, or null for something generated on the fly.
  storagePath: string | null;
  // Where it belongs inside the firm's backup folder.
  folder: string;
  fileName: string;
  // For a generated document: something that changes when the document
  // does, so an unchanged one is not sent again.
  marker?: string;
  // How to produce a generated document's bytes. Called only when the
  // plan says this one is actually going up, so a set that is already
  // backed up is never rebuilt.
  generate?: () => Promise<Uint8Array | null>;
};

export type AlreadyUploaded = { storage_path: string };

export type PlannedUpload = { storagePath: string | null; key: string; remotePath: string; generate?: () => Promise<Uint8Array | null> };

// The key a file is remembered by. A stored file is remembered by its
// storage path, which is unique and permanent. A generated one has no
// storage path, so it is remembered by where it lands plus its marker —
// change the marker and it becomes a different key, and so is sent again.
export function uploadKey(candidate: SyncCandidate) {
  if (candidate.storagePath) return candidate.storagePath;
  return `generated:${candidate.folder}/${candidate.fileName}:${candidate.marker || ""}`;
}

export function planUploads(candidates: SyncCandidate[], alreadyUploaded: AlreadyUploaded[], rootFolder: string, jobFolder: string): PlannedUpload[] {
  const done = new Set(alreadyUploaded.map((u) => u.storage_path));
  const planned = new Map<string, PlannedUpload>();

  for (const candidate of candidates) {
    const key = uploadKey(candidate);
    if (done.has(key)) continue;
    // The same file can be reached twice on one job — a document shown
    // under two headings, a photo counted twice. Sending it twice would
    // be two uploads for one file.
    if (planned.has(key)) continue;
    planned.set(key, {
      storagePath: candidate.storagePath,
      key,
      remotePath: remotePath(rootFolder, jobFolder, candidate.folder, candidate.fileName),
      generate: candidate.generate,
    });
  }

  return [...planned.values()];
}
