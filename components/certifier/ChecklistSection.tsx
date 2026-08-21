import { displayStatus } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { updateItemMeta, certifierUploadItem, notifyClientOfChecklist } from "@/lib/actions/jobs";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { DocumentPicker } from "@/components/certifier/DocumentPicker";
import { RemoveItemButton } from "@/components/certifier/RemoveItemButton";
import { StampToggle } from "@/components/certifier/StampToggle";
import { ItemStatusProvider, ItemStatusBadge, ItemStatusActions } from "@/components/certifier/ItemStatus";
import { EditableChecklistItemHeader } from "@/components/certifier/EditableChecklistItemHeader";
import { AmendmentsList } from "@/components/certifier/AmendmentsList";
import { CheckCircle2, FileText, Layers, Award, HardHat, Droplets, ClipboardList, Landmark, Ruler } from "lucide-react";
import type { ChecklistItem, Amendment } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[] };
type LibItem = { title: string; description: string | null; category: string | null };

// Thin-line document icon chosen by keyword match on the item's title —
// purely decorative, falls back to a generic file icon.
function DocumentIcon({ title }: { title: string }) {
  const t = title.toLowerCase();
  const props = { size: 16, strokeWidth: 1.5, className: "text-secondary" };
  if (t.includes("plan")) return <Layers {...props} />;
  if (t.includes("certificate") || t.includes("cert") || t.includes("basix")) return <Award {...props} />;
  if (t.includes("engineer") || t.includes("structural")) return <HardHat {...props} />;
  if (t.includes("stormwater") || t.includes("drainage") || t.includes("water")) return <Droplets {...props} />;
  if (t.includes("survey") || t.includes("dimension")) return <Ruler {...props} />;
  if (t.includes("title") || t.includes("88b") || t.includes("deposited")) return <Landmark {...props} />;
  if (t.includes("form") || t.includes("application")) return <ClipboardList {...props} />;
  return <FileText {...props} />;
}

export async function ChecklistSection({
  jobId,
  firmId,
  checklistId,
  label,
  library,
  items,
}: {
  jobId: string;
  firmId: string;
  checklistId: string;
  label: string;
  library: LibItem[];
  items: ItemWithAmendments[];
}) {
  const pickerLibrary = library.map((l) => ({ title: l.title, desc: l.description || "", category: l.category || "Other" }));
  const existingTitles = items.map((i) => i.title);
  const doneCount = items.filter((i) => i.status === "approved").length;
  const percent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const allComplete = items.length > 0 && doneCount === items.length;
  const remaining = items.length - doneCount;

  return (
    <div className="space-y-5">
      {items.length > 0 && (
        <div className="rounded-xl border border-line bg-white shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {allComplete && (
                <span className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} className="text-accent" />
                </span>
              )}
              <div>
                <div className={`text-sm font-semibold ${allComplete ? "text-accent" : "text-heading"}`}>
                  {allComplete ? "All items complete" : `${remaining} item${remaining === 1 ? "" : "s"} remaining`}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {doneCount}/{items.length} documents approved ({percent}%)
                </div>
              </div>
            </div>
            <form action={notifyClientOfChecklist} className="shrink-0">
              <input type="hidden" name="job_id" value={jobId} />
              <input type="hidden" name="checklist_id" value={checklistId} />
              <input type="hidden" name="label" value={label} />
              <button className="text-xs font-semibold text-secondary hover:underline whitespace-nowrap">Notify client of update</button>
            </form>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-4">
            <div className={`h-full rounded-full transition-all ${allComplete ? "bg-accent" : "bg-secondary"}`} style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} jobId={jobId} firmId={firmId} />
          ))}
        </div>
      )}

      {items.length === 0 && <div className="text-sm text-muted">No documents requested yet.</div>}
      <DocumentPicker jobId={jobId} checklistId={checklistId} library={pickerLibrary} existingTitles={existingTitles} />
    </div>
  );
}

async function ItemRow({ item, jobId, firmId }: { item: ItemWithAmendments; jobId: string; firmId: string }) {
  const status = displayStatus(item);
  const fileUrl = await signedUrl(item.file_path);

  return (
    <ItemStatusProvider itemId={item.id} jobId={jobId} status={item.status} amendments={item.amendments}>
      <div className="card-lift rounded-xl border border-line bg-white shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-slate-50 border border-line flex items-center justify-center shrink-0 mt-0.5">
              <DocumentIcon title={item.title} />
            </span>
            <div className="flex-1 min-w-0">
              <EditableChecklistItemHeader itemId={item.id} jobId={jobId} title={item.title} description={item.description || ""} version={item.version} statusDot={status.dot} />
              <ItemStatusBadge />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium text-white bg-secondary hover:opacity-90 rounded-full px-4 py-2 whitespace-nowrap"
              >
                <FileText size={14} /> View
              </a>
            )}
            <RemoveItemButton itemId={item.id} jobId={jobId} title={item.title} />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <ItemStatusActions />
          <ActionUpload
            action={certifierUploadItem}
            fields={{ item_id: item.id, job_id: jobId }}
            pathPrefix={`${firmId}/${jobId}/checklist/${item.id}`}
            label="Upload on client's behalf"
          />
          <StampToggle itemId={item.id} jobId={jobId} requiresStamping={item.requires_stamping} />
        </div>

        <details className="mt-3">
          <summary className="text-xs text-muted cursor-pointer hover:text-heading">Document details (revision, date, prepared by)</summary>
          <form action={updateItemMeta} className="mt-2 grid sm:grid-cols-5 gap-2">
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="job_id" value={jobId} />
            <input name="revision" defaultValue={item.revision || ""} placeholder="Revision" className="px-2 py-1.5 rounded border border-line text-xs" />
            <input type="date" name="document_date" defaultValue={item.document_date || ""} className="px-2 py-1.5 rounded border border-line text-xs" />
            <input name="prepared_by" defaultValue={item.prepared_by || ""} placeholder="Prepared by" className="px-2 py-1.5 rounded border border-line text-xs" />
            <input name="drawing_number" defaultValue={item.drawing_number || ""} placeholder="Drawing number" className="px-2 py-1.5 rounded border border-line text-xs" />
            <input name="clause_ref" defaultValue={item.clause_ref || ""} placeholder="NCC/BCA clause ref" className="px-2 py-1.5 rounded border border-line text-xs" />
            <button className="sm:col-span-5 text-xs text-secondary hover:underline text-left">Save details</button>
          </form>
        </details>

        <AmendmentsList itemId={item.id} jobId={jobId} amendments={item.amendments} />
      </div>
    </ItemStatusProvider>
  );
}
