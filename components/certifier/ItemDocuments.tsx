import { signedUrl } from "@/lib/storage";
import { FileText, History } from "lucide-react";
import { formatISODate } from "@/lib/business";
import { removeItemDocumentVersion } from "@/lib/actions/jobs";
import { currentDocuments, versionsOf } from "@/lib/checklistDocuments";
import { ItemDocumentDetails } from "@/components/certifier/ItemDocumentDetails";
import { ItemMetaDetails } from "@/components/certifier/ItemMetaDetails";
import { CertifierDocumentUpload } from "@/components/certifier/CertifierDocumentUpload";
import type { ChecklistItem, ChecklistItemFile } from "@/types/db";

type ItemWithFiles = ChecklistItem & { checklist_item_files?: ChecklistItemFile[] | null };

// Every document held against a checklist item, each with the Schedule 1
// details belonging to it and its own version history.
//
// An item usually holds one. Some are satisfied by two — two structural
// certificates for a single certification, a report and its addendum —
// and both go into the approved set and get their own Schedule 1 row.
export async function ItemDocuments({ item, jobId, firmId }: { item: ItemWithFiles; jobId: string; firmId: string }) {
  const docs = currentDocuments(item);
  const pathPrefix = `${firmId}/${jobId}/checklist/${item.id}`;
  const withUrls = await Promise.all(docs.map(async (doc) => ({ doc, url: await signedUrl(doc.filePath), versions: versionsOf(item, doc.documentNo) })));

  return (
    <div className="mt-3 space-y-3">
      {withUrls.map(({ doc, url, versions }, i) => (
        <div key={doc.id} className="rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center gap-3 text-xs mb-2">
            <span className="font-semibold text-heading">Document {i + 1}</span>
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline">
                <FileText size={12} /> Open
              </a>
            )}
            {versions.length > 1 && (
              <details>
                <summary className="inline-flex items-center gap-1 text-placeholder cursor-pointer hover:text-heading">
                  <History size={11} /> {versions.length} versions
                </summary>
                <ul className="mt-1.5 space-y-1 border-l-2 border-line pl-3">
                  {versions.map((v) => (
                    <li key={v.id} className="text-placeholder flex items-center gap-2">
                      <span>
                        v{v.version} · {formatISODate(v.created_at)} · {v.uploaded_by_role === "client" ? "uploaded by the client" : "uploaded on the client’s behalf"}
                        {v.is_current ? " · in use" : ""}
                      </span>
                      {/* Superseded copies can go; the version in use is
                          protected — removing it is what "Remove this
                          document" does. */}
                      {!v.is_current && (
                        <form action={removeItemDocumentVersion}>
                          <input type="hidden" name="file_id" value={v.id} />
                          <input type="hidden" name="job_id" value={jobId} />
                          <button className="text-error hover:underline">Delete</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <CertifierDocumentUpload itemId={item.id} jobId={jobId} pathPrefix={pathPrefix} documentNo={doc.documentNo} label="Upload new version" />
          </div>
          {/* Only offered once there is more than one: removing the only
              document is what "reopen" already does to the whole item. */}
          <ItemDocumentDetails doc={doc} itemId={item.id} itemTitle={item.title} jobId={jobId} removable={docs.length > 1} />
        </div>
      ))}
      {/* An item with nothing uploaded still opens onto the same detail
          fields — kept on the item, travelling onto the document when it
          arrives. Without this the panel opened onto nothing and looked
          broken. */}
      {docs.length === 0 && <ItemMetaDetails item={item} jobId={jobId} />}
      {/* "new" rather than a number, so this adds a document alongside
          rather than replacing one. */}
      <CertifierDocumentUpload itemId={item.id} jobId={jobId} pathPrefix={pathPrefix} documentNo="new" label={docs.length === 0 ? "Upload a document" : "Add another document"} />
    </div>
  );
}
