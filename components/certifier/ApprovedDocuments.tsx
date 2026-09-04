import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import { signedUrl } from "@/lib/storage";
import { pathwayLabel, type Pathway } from "@/lib/business";
import type { ChecklistItem, ChecklistItemFile, Job } from "@/types/db";

type ItemWithFiles = ChecklistItem & { checklist_item_files?: ChecklistItemFile[] | null };

// The approval, read-only: what an inspector inspects against. The
// issued certificate and each approved document, as links — no
// approving, no re-opening, no uploads. The database refuses an
// inspector those anyway (migration 0073); this screen simply never
// offers them.
export async function ApprovedDocuments({ job, items }: { job: Job; items: ItemWithFiles[] }) {
  const approved = items.filter((i) => i.status === "approved");
  const rows = await Promise.all(
    approved.map(async (item) => {
      const files = (item.checklist_item_files || []).filter((f) => f.is_current !== false);
      const links = (await Promise.all(files.map(async (f) => ({ file: f, url: await signedUrl(f.file_path) })))).filter((l) => l.url);
      return { item, links };
    })
  );

  const label = pathwayLabel(job.pathway as Pathway);
  const issued = job.pathway !== "PC_OC" && job.pathway_generated;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-line p-5">
        <div className="text-sm font-bold text-heading">The approval</div>
        {issued ? (
          <Link href={`/certificate/pathway/${job.id}`} target="_blank" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline">
            <FileText size={14} /> View the issued {label} <ExternalLink size={12} />
          </Link>
        ) : (
          <p className="mt-1 text-sm text-muted">
            {job.pathway === "PC_OC" ? "The approval was issued by another certifier — its documents are below." : `The ${label} has not been issued yet.`}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-line p-5">
        <div className="text-sm font-bold text-heading mb-1">Approved documents</div>
        <p className="text-xs text-muted mb-3">Read-only — you inspect against these. Changes to the project are made by the firm.</p>
        {rows.length === 0 ? (
          <p className="text-sm text-placeholder">Nothing has been approved yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ item, links }) => (
              <li key={item.id} className="py-2.5 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-heading">{item.title}</div>
                  <div className="text-xs text-placeholder">
                    {[item.drawing_number, item.revision && `Rev ${item.revision}`, item.prepared_by].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {links.length === 0 ? (
                    <span className="text-xs text-placeholder">no file held</span>
                  ) : (
                    links.map(({ file, url }, i) => (
                      <a key={file.id} href={url!} target="_blank" rel="noreferrer" className="text-xs font-semibold text-secondary hover:underline">
                        {links.length > 1 ? `View file ${i + 1}` : "View"}
                      </a>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
