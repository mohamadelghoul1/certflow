// What a client may put into the portal.
//
// Nothing scans these files, and nothing reasonably could without
// putting a paid service in front of every upload. What is worth doing
// is refusing the shapes that are only ever an attack: a certifier is
// sent drawings, certificates and photographs, never a program.
//
// This is a list of what is allowed rather than a list of what is
// banned. A banned list is a promise to think of everything, and it only
// has to be wrong once.
//
// The same list is enforced twice. Here, so the person uploading is told
// plainly and before the file leaves their phone; and in the database
// (migration 0062), because a check written in the browser is advice —
// the upload goes straight from the browser to storage, and anyone
// willing to edit a script can skip it.

export const ALLOWED_UPLOAD_EXTENSIONS = [
  // What a document actually arrives as
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  // Photographs, including what an iPhone sends
  "jpg",
  "jpeg",
  "png",
  "heic",
  "heif",
  "webp",
  // Drawings
  "dwg",
  "dxf",
] as const;

// What one client upload may weigh.
//
// Twenty is comfortable for a scanned structural certificate or a full
// drawing set as a PDF, and it is one fortieth of the whole storage
// plan — so no single client can take a noticeable bite out of it, and a
// firm that fills up does it gradually enough to notice.
//
// The certifier is not capped. They are uploading their own work to
// their own storage, they can see what it is costing them on the
// Storage page, and a limit there would only get in the way of a
// certificate that happens to be large.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

// What the portal tells a client before they choose a file. Written out
// once so the note, the refusal and the check can never disagree.
export const UPLOAD_HINT = `PDF, Word, JPG, PNG or DWG — up to ${MAX_UPLOAD_MB} MB.`;

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

// Why this file cannot be accepted, or null if it can.
//
// The message says what to do rather than what went wrong: someone
// holding a file their certifier needs is not helped by "invalid type".
export function uploadProblem(file: { name: string; size: number }): string | null {
  const extension = extensionOf(file.name);

  if (!extension) {
    return "That file has no file type on the end of its name, so we can't tell what it is. Rename it to end in .pdf, .jpg or .docx and try again.";
  }
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension)) {
    return `We can't accept .${extension} files. Send documents as PDF or Word, photos as JPG or PNG, and drawings as PDF or DWG.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.ceil(file.size / (1024 * 1024));
    return `That file is ${mb} MB and the limit is ${MAX_UPLOAD_MB} MB. Send it as a PDF, or split it into parts.`;
  }
  if (file.size === 0) {
    return "That file is empty — it may not have finished saving. Check it opens on your device, then try again.";
  }
  return null;
}
