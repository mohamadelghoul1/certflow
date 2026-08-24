import { signedUrl } from "@/lib/storage";
import { formatISODate } from "@/lib/business";
import { History, FileText } from "lucide-react";
import type { ChecklistItemFile } from "@/types/db";

// Every version of a document, newest first, each one openable.
//
// A client who sends architectural plans three times leaves three files;
// checklist_items only ever points at the latest, so without this the set
// a certificate was actually assessed against couldn't be produced
// afterwards. Collapsed by default — the current version is already a
// button at the top of the card — and only shown at all once there is
// more than one.
export async function DocumentVersions({ files, currentPath }: { files: ChecklistItemFile[]; currentPath: string | null }) {
  if (files.length < 2) return null;

  const ordered = [...files].sort((a, b) => b.version - a.version);
  const withUrls = await Promise.all(ordered.map(async (f) => ({ ...f, url: await signedUrl(f.file_path) })));

  return (
    <details className="mt-3">
      <summary className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer hover:text-heading">
        <History size={12} /> {files.length} versions uploaded
      </summary>
      <ul className="mt-2 space-y-1.5 border-l-2 border-line pl-3">
        {withUrls.map((f) => {
          const isCurrent = !!currentPath && f.file_path === currentPath;
          return (
            <li key={f.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`font-semibold ${isCurrent ? "text-heading" : "text-placeholder"}`}>v{f.version}</span>
              {isCurrent && <span className="px-1.5 py-0.5 rounded bg-success-bg text-success font-medium">Current</span>}
              <span className="text-placeholder">{formatISODate(f.created_at)}</span>
              <span className="text-placeholder">
                {f.uploaded_by_role === "client" ? "uploaded by the client" : "uploaded on the client\u2019s behalf"}
              </span>
              {f.url && (
                <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline">
                  <FileText size={11} /> Open
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
