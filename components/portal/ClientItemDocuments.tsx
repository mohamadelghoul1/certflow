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
//
// Two is as far as a client can go. A third document is nearly always a
// new version of one already sent, and every extra one lands in the
// approval; where a job genuinely needs more, the certifier adds it. The
// database refuses a third either way — this only decides what is
// offered, so the limit reads as a limit rather than as an error after
// the file has already gone up.
export async function ClientItemDocuments({ item, jobId, firmId, canUpload }: { item: ItemWithFiles; jobId: string; firmId: string; canUpload: boolean }) {
  const docs = currentDocuments(item);
  const pathPrefix = `${firmId}/${jobId}/checklist/${item.id}`;
  const withUrls = await Promise.all(docs.map(async (doc) => ({ doc, url: await signedUrl(doc.filePath), versions: versionsOf(item, doc.documentNo) })));

  if (docs.length === 0) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-placeholder">Not yet uploaded</span>
        {canUpload && <UploadClientDocument itemId={item.id} pathPrefix={pathPrefix} hasFile={false} documentNo={1} label="Upload" />}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {/* One row per document: what it is on the left, when it was
          submitted on the right — the layout of every document register
          the trade already knows. Replacing a document happens by
          dropping a file on the card, not through a button of its own. */}
      {withUrls.map(({ doc, url, versions }, i) => (
        <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
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
                <History size={11} /> {versions.length} versions
              </span>
            )}
          </div>
          {versions[0]?.created_at && <span className="text-sm font-medium text-muted">Submitted {formatISODate(versions[0].created_at)}</span>}
        </div>
      ))}
      {/* One document per item from the client's side — a corrected copy
          arrives as a new version of it, never as a second document
          sitting beside the old one. Where an item genuinely needs two
          documents, the certifier adds the second from their side. */}
      {canUpload && docs.length === 1 && (
        <div className="flex justify-end">
          <UploadClientDocument itemId={item.id} pathPrefix={pathPrefix} hasFile documentNo={docs[0].documentNo} label="Upload updated document" />
        </div>
      )}
    </div>
  );
}
