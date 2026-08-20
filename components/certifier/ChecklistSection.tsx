import { displayStatus, unresolvedCount } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { approveItem, reopenItem, toggleStamping, updateItemMeta, certifierUploadItem, removeChecklistItem, notifyClientOfChecklist } from "@/lib/actions/jobs";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { DocumentPicker } from "@/components/certifier/DocumentPicker";
import { RemoveItemButton } from "@/components/certifier/RemoveItemButton";
import { EditableChecklistItemHeader } from "@/components/certifier/EditableChecklistItemHeader";
import { AmendmentsList } from "@/components/certifier/AmendmentsList";
import { FileText } from "lucide-react";
import type { ChecklistItem, Amendment } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[] };
type LibItem = { title: string; description: string | null; category: string | null };

function statusBadgeClasses(dot: string) {
  if (dot.includes("amber")) return "bg-amber-50 text-amber-700";
  if (dot.includes("emerald")) return "bg-emerald-50 text-emerald-700";
  if (dot.includes("blue")) return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
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
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${allComplete ? "bg-emerald-600" : "bg-teal-700"}`} style={{ width: `${percent}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className={`text-xs font-medium ${allComplete ? "text-emerald-700" : "text-slate-500"}`}>
                {allComplete ? "All items complete" : `${remaining} item${remaining === 1 ? "" : "s"} remaining`}
              </span>
              <span className="text-xs text-slate-400">
                {doneCount}/{items.length} ({percent}%)
              </span>
            </div>
          </div>
          <form action={notifyClientOfChecklist} className="shrink-0">
            <input type="hidden" name="job_id" value={jobId} />
            <input type="hidden" name="checklist_id" value={checklistId} />
            <input type="hidden" name="label" value={label} />
            <button className="text-xs font-semibold text-teal-800 hover:underline whitespace-nowrap pb-2">Notify client of update</button>
          </form>
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
          <div className="flex items-center justify-between bg-teal-900 text-white text-[11px] font-semibold uppercase tracking-wider px-4 py-2.5">
            <span>Document</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} jobId={jobId} firmId={firmId} />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && <div className="text-sm text-slate-400">No documents requested yet.</div>}
      <DocumentPicker jobId={jobId} checklistId={checklistId} library={pickerLibrary} existingTitles={existingTitles} />
    </div>
  );
}

async function ItemRow({ item, jobId, firmId }: { item: ItemWithAmendments; jobId: string; firmId: string }) {
  const status = displayStatus(item);
  const fileUrl = await signedUrl(item.file_path);
  const canApprove = item.status === "submitted" && unresolvedCount(item) === 0;

  return (
    <div className="px-4 py-3.5 hover:bg-blue-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <EditableChecklistItemHeader itemId={item.id} jobId={jobId} title={item.title} description={item.description || ""} version={item.version} statusDot={status.dot} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${statusBadgeClasses(status.dot)}`}>{status.label}</span>
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs font-semibold text-teal-800 border border-teal-200 rounded-md px-2.5 py-1 hover:bg-teal-50 whitespace-nowrap"
            >
              <FileText size={12} /> View
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {canApprove && (
          <form action={approveItem}>
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="job_id" value={jobId} />
            <button className="text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-md">Approve</button>
          </form>
        )}
        {item.status === "approved" && (
          <form action={reopenItem}>
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="job_id" value={jobId} />
            <button className="text-xs text-slate-400 hover:text-slate-600 hover:underline">Reopen</button>
          </form>
        )}
        <ActionUpload
          action={certifierUploadItem}
          fields={{ item_id: item.id, job_id: jobId }}
          pathPrefix={`${firmId}/${jobId}/checklist/${item.id}`}
          label="Upload on client's behalf"
        />
        <form action={toggleStamping} className="inline">
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <input type="hidden" name="value" value={(!item.requires_stamping).toString()} />
          <button className={`text-xs px-2 py-1 rounded-md border ${item.requires_stamping ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-500"}`}>
            {item.requires_stamping ? "Stamp: required" : "Stamp: not required"}
          </button>
        </form>
        <RemoveItemButton itemId={item.id} jobId={jobId} title={item.title} />
      </div>

      <details className="mt-3">
        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Document details (revision, date, prepared by)</summary>
        <form action={updateItemMeta} className="mt-2 grid sm:grid-cols-5 gap-2">
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <input name="revision" defaultValue={item.revision || ""} placeholder="Revision" className="px-2 py-1.5 rounded border border-slate-200 text-xs" />
          <input type="date" name="document_date" defaultValue={item.document_date || ""} className="px-2 py-1.5 rounded border border-slate-200 text-xs" />
          <input name="prepared_by" defaultValue={item.prepared_by || ""} placeholder="Prepared by" className="px-2 py-1.5 rounded border border-slate-200 text-xs" />
          <input name="drawing_number" defaultValue={item.drawing_number || ""} placeholder="Drawing number" className="px-2 py-1.5 rounded border border-slate-200 text-xs" />
          <input name="clause_ref" defaultValue={item.clause_ref || ""} placeholder="NCC/BCA clause ref" className="px-2 py-1.5 rounded border border-slate-200 text-xs" />
          <button className="sm:col-span-5 text-xs text-teal-800 hover:underline text-left">Save details</button>
        </form>
      </details>

      <AmendmentsList itemId={item.id} jobId={jobId} amendments={item.amendments} />
    </div>
  );
}
