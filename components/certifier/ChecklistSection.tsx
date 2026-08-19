import { displayStatus, unresolvedCount } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { approveItem, reopenItem, addAmendment, resolveAmendment, toggleStamping, updateItemMeta, certifierUploadItem, removeChecklistItem, notifyClientOfChecklist } from "@/lib/actions/jobs";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { DocumentPicker } from "@/components/certifier/DocumentPicker";
import { RemoveItemButton } from "@/components/certifier/RemoveItemButton";
import type { ChecklistItem, Amendment } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[] };
type LibItem = { title: string; description: string | null; category: string | null };

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

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex justify-end">
          <form action={notifyClientOfChecklist}>
            <input type="hidden" name="job_id" value={jobId} />
            <input type="hidden" name="checklist_id" value={checklistId} />
            <input type="hidden" name="label" value={label} />
            <button className="text-xs font-semibold text-teal-800 hover:underline">Notify client of update</button>
          </form>
        </div>
      )}
      {items.map((item) => (
        <ItemRow key={item.id} item={item} jobId={jobId} firmId={firmId} />
      ))}
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
    <div className="border border-slate-200 rounded-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            <span className="text-sm font-semibold text-teal-900">{item.title}</span>
            {item.version > 0 && <span className="text-[11px] text-slate-400">v{item.version}</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
          <div className="text-xs mt-1 font-medium" style={{ color: status.dot.includes("amber") ? "#b45309" : status.dot.includes("emerald") ? "#047857" : "#475569" }}>
            {status.label}
          </div>
        </div>
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-800 hover:underline shrink-0">
            View file
          </a>
        )}
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

      {item.amendments.length > 0 && (
        <div className="mt-3 space-y-2">
          {item.amendments.map((a) => (
            <div key={a.id} className={`text-xs rounded-md px-3 py-2 flex items-start justify-between gap-3 ${a.resolved ? "bg-slate-50 text-slate-400 line-through" : "bg-amber-50 text-amber-800"}`}>
              <span>{a.text}</span>
              {!a.resolved && (
                <form action={resolveAmendment} className="shrink-0">
                  <input type="hidden" name="amendment_id" value={a.id} />
                  <input type="hidden" name="job_id" value={jobId} />
                  <button className="font-semibold hover:underline">Resolve</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <form action={addAmendment} className="mt-3 flex gap-2">
        <input type="hidden" name="item_id" value={item.id} />
        <input type="hidden" name="job_id" value={jobId} />
        <input name="text" placeholder="Add an amendment point…" className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-xs" />
        <button className="text-xs font-semibold text-amber-700 hover:underline">Add</button>
      </form>
    </div>
  );
}
