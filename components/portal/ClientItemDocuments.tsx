import { signedUrl } from "@/lib/storage";
import { FileText, History } from "lucide-react";
import { formatISODate } from "@/lib/business";
import { currentDocuments, versionsOf } from "@/lib/checklistDocuments";
import { UploadClientDocument } from "@/components/portal/UploadClientDocument";
import type { ChecklistItem, ChecklistItemFile } from "@/types/db";

type ItemWithFiles = ChecklistItem & { checklist_item_files?: ChecklistItemFile[] | null };

// The documents sent for one checklist item.
//
// Usually one, but some items are satisfied by two — two structural
// certificates for a single certification, a report and its addendum —
// and both belong in the approval. Each can be replaced on its own, so
// sending a corrected version of the second doesn't disturb the first.
export async function ClientItemDocuments({ item, jobId, firmId, canUpload }: { item: ItemWithFiles; jobId: string; firmId: string; canUpload: boolean }) {
  const docs = currentDocuments(item);
  const pathPrefix = `${firmId}/${jobId}/checklist/${item.id}`;
  const withUrls = await Promise.all(docs.map(async (doc) => ({ doc, url: await signedUrl(doc.filePath), versions: versionsOf(item, doc.documentNo) })));

  if (docs.length === 0) {
    return <div className="mt-2">{canUpload && <UploadClientDocument itemId={item.id} pathPrefix={pathPrefix} hasFile={false} documentNo={1} />}</div>;
  }

  return (
    <div className="mt-2 space-y-2">
      {withUrls.map(({ doc, url, versions }, i) => (
        <div key={doc.id} className="flex flex-wrap items-center gap-3 text-xs">
          {docs.length > 1 && <span className="font-semibold text-heading">{i + 1}.</span>}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline">
              <FileText size={12} /> {doc.label || "Open document"}
            </a>
          ) : (
            <span className="text-placeholder">Not yet uploaded</span>
          )}
          {versions.length > 1 && (
            <span className="inline-flex items-center gap-1 text-placeholder">
              <History size={11} /> {versions.length} versions · latest {formatISODate(versions[0].created_at)}
            </span>
          )}
          {canUpload && <UploadClientDocument itemId={item.id} pathPrefix={pathPrefix} hasFile documentNo={doc.documentNo} label="Upload a new version" />}
        </div>
      ))}
      {/* No document number, so this adds one alongside rather than
          replacing anything. */}
      {canUpload && <UploadClientDocument itemId={item.id} pathPrefix={pathPrefix} hasFile={false} label="Add another document" />}
    </div>
  );
}
