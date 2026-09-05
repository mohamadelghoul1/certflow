import JSZip from "jszip";
import { currentDocuments, type ItemLike } from "@/lib/checklistDocuments";

// A checklist row as this needs it: whatever currentDocuments reads,
// plus the name the certifier gave it, which is what the file is called.
export type NamedItem = ItemLike & { title: string };
import { approvedDocumentFile } from "@/lib/archive/archivePaths";

// One checklist's documents, as a single zip.
//
// A CDC checklist can run to twenty items, and a certifier who wants to
// read what the client sent should not have to press twenty links and
// then hunt through a Downloads folder full of "scan_0001.pdf". This is
// the same set of files, named the way the checklist names them and
// numbered in the order they appear on it.
//
// The current version of each document, not every version: a certifier
// downloading the checklist wants what is on it now. The whole history
// is in the job archive, which is a different button for a different
// day.

export type DocumentEntry = { fileName: string; storagePath: string };

// What the zip should hold, worked out before a single byte is fetched —
// so a checklist with nothing on it can be refused without a download,
// and so this can be tested without any storage at all.
export function documentEntries(items: NamedItem[]): DocumentEntry[] {
  const entries: DocumentEntry[] = [];
  const used = new Set<string>();

  items.forEach((item, index) => {
    const docs = currentDocuments(item);
    for (const doc of docs) {
      if (!doc.filePath) continue;
      let fileName = approvedDocumentFile(index + 1, item.title, doc.filePath, doc.label, doc.documentNo, docs.length > 1);
      // Two items named the same thing would otherwise become one file
      // in the zip, and the second would quietly replace the first.
      if (used.has(fileName.toLowerCase())) {
        const dot = fileName.lastIndexOf(".");
        const stem = dot === -1 ? fileName : fileName.slice(0, dot);
        const extension = dot === -1 ? "" : fileName.slice(dot);
        let n = 2;
        while (used.has(`${stem} (${n})${extension}`.toLowerCase())) n += 1;
        fileName = `${stem} (${n})${extension}`;
      }
      used.add(fileName.toLowerCase());
      entries.push({ fileName, storagePath: doc.filePath });
    }
  });

  return entries;
}

// Builds the zip. A file that cannot be fetched is left out rather than
// failing the whole download — one missing document must not cost the
// certifier the other nineteen — and the caller is told how many landed.
export async function buildChecklistZip(
  entries: DocumentEntry[],
  fetchFile: (storagePath: string) => Promise<Uint8Array | null>
): Promise<{ bytes: Uint8Array; included: number; missing: string[] }> {
  const zip = new JSZip();
  const missing: string[] = [];
  let included = 0;

  for (const entry of entries) {
    const bytes = await fetchFile(entry.storagePath);
    if (!bytes) {
      missing.push(entry.fileName);
      continue;
    }
    zip.file(entry.fileName, bytes);
    included += 1;
  }

  // Said inside the zip rather than only in a log: the certifier opening
  // it is the person who needs to know something is not there.
  if (missing.length > 0) {
    zip.file(
      "MISSING FILES.txt",
      [
        "These documents are on the checklist but their files could not be read,",
        "so they are not in this zip. Open them in Certlyn to check.",
        "",
        ...missing.map((name) => `  - ${name}`),
      ].join("\n")
    );
  }

  return { bytes: await zip.generateAsync({ type: "uint8array" }), included, missing };
}
