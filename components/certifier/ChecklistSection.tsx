import { displayStatus, formatISODate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { notifyClientOfChecklist } from "@/lib/actions/jobs";
import { DocumentPicker } from "@/components/certifier/DocumentPicker";
import { RemoveItemButton } from "@/components/certifier/RemoveItemButton";
import { ItemStatusProvider, ItemCard, ItemStatusBadge, ItemStatusActions, ApprovalInclusionToggle, NotInApprovalBadge } from "@/components/certifier/ItemStatus";
import { ChecklistOrderProvider, MoveButtons } from "@/components/certifier/ChecklistOrder";
import { EditableChecklistItemHeader } from "@/components/certifier/EditableChecklistItemHeader";
import { AmendmentsList } from "@/components/certifier/AmendmentsList";
import { DocumentDetailsForm } from "@/components/certifier/DocumentDetailsForm";
import { StampPositioner } from "@/components/certifier/StampPositioner";
import { stampLines } from "@/lib/pdf/stamp";
import type { StampPreview } from "@/lib/pdf/stampDetails";
import { CheckCircle2, Download, FileText, Layers, Award, HardHat, Droplets, ClipboardList, Landmark, Ruler } from "lucide-react";
import type { ChecklistItem, Amendment } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[] };
type LibItem = { id: string; title: string; description: string | null; category: string | null; template_file_path: string | null };

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
  stamp = null,
  partOfApproval = false,
}: {
  jobId: string;
  firmId: string;
  checklistId: string;
  label: string;
  library: LibItem[];
  items: ItemWithAmendments[];
  // True for the checklist the approval is built from. Only there does it
  // mean anything to leave a document out of the approved set.
  partOfApproval?: boolean;
  // Only the pathway checklist stamps its documents, so the other
  // checklists are rendered without it and show no positioner.
  stamp?: StampPreview | null;
}) {
  const pickerLibrary = library.map((l) => ({ id: l.id, title: l.title, desc: l.description || "", category: l.category || "Other" }));
  // The firm's blank forms, by library item id, so a row can offer the
  // form the client is being asked to fill in. Taken from the library this
  // checklist was built from — every item here links to a row in it.
  const templatePaths: Record<string, string> = {};
  for (const l of library) if (l.template_file_path) templatePaths[l.id] = l.template_file_path;
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
                <span className="w-9 h-9 rounded-full bg-success-bg flex items-center justify-center shrink-0">
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
          <div className="h-2 w-full bg-surface rounded-full overflow-hidden mt-4">
            <div className={`h-full rounded-full transition-all ${allComplete ? "bg-accent" : "bg-secondary"}`} style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-4">
          <ChecklistOrderProvider
            jobId={jobId}
            rows={items.map((item) => ({
              id: item.id,
              node: <ItemRow item={item} jobId={jobId} firmId={firmId} stamp={stamp} templatePaths={templatePaths} partOfApproval={partOfApproval} />,
            }))}
          />
        </div>
      )}

      {items.length === 0 && <div className="text-sm text-muted">No documents requested yet.</div>}
      <DocumentPicker jobId={jobId} checklistId={checklistId} library={pickerLibrary} existingTitles={existingTitles} />
    </div>
  );
}

// Whatever's been filled in under "Document details" shown at a glance,
// so the certifier can see a document's reference and revision without
// opening the panel. Blank fields are left out rather than printed as
// "—", so nothing is added to the card until there's something to say.
function DocumentMeta({ item }: { item: ChecklistItem }) {
  const parts = [
    item.prepared_by && `Prepared by ${item.prepared_by}`,
    item.drawing_number && `Ref. ${item.drawing_number}`,
    item.revision && `Rev. ${item.revision}`,
    item.document_date && formatISODate(item.document_date),
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="text-xs text-muted mt-0.5">{parts.join(" · ")}</div>;
}

async function ItemRow({
  item,
  jobId,
  firmId,
  stamp,
  templatePaths,
  partOfApproval,
}: {
  item: ItemWithAmendments;
  jobId: string;
  firmId: string;
  stamp: StampPreview | null;
  templatePaths: Record<string, string>;
  partOfApproval: boolean;
}) {
  const status = displayStatus(item);
  const fileUrl = await signedUrl(item.file_path);
  // The blank form for this document, where the firm has attached one.
  const templateUrl = await signedUrl(item.template_library_item_id ? templatePaths[item.template_library_item_id] : null);

  return (
    <ItemStatusProvider itemId={item.id} jobId={jobId} status={item.status} amendments={item.amendments} includeInApproval={item.include_in_approval !== false}>
      <ItemCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-surface border border-line flex items-center justify-center shrink-0 mt-0.5">
              <DocumentIcon title={item.title} />
            </span>
            <div className="flex-1 min-w-0">
              <EditableChecklistItemHeader itemId={item.id} jobId={jobId} title={item.title} description={item.description || ""} version={item.version} statusDot={status.dot} />
              <DocumentMeta item={item} />
              <div className="flex flex-wrap items-center gap-2">
                <ItemStatusBadge />
                {partOfApproval && <NotInApprovalBadge />}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* The checklist's order is the order the approved set is
                assembled in and Schedule 1 lists the documents, so moving
                one changes the finished approval, not just this screen. */}
            <MoveButtons itemId={item.id} />
            {templateUrl && (
              <a
                href={templateUrl}
                target="_blank"
                rel="noreferrer"
                title="The blank form the client fills in for this document"
                className="flex items-center gap-1.5 text-sm font-medium text-muted border border-line hover:bg-hover rounded-full px-4 py-2 whitespace-nowrap"
              >
                <Download size={14} /> Blank form
              </a>
            )}
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

        <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-2">
          <ItemStatusActions
            itemId={item.id}
            jobId={jobId}
            firmId={firmId}
            requiresStamping={item.requires_stamping}
            // Only worth offering once there is a document to put a stamp on.
            stampPositioner={
              stamp && fileUrl ? (
                <StampPositioner
                  itemId={item.id}
                  jobId={jobId}
                  fileUrl={fileUrl}
                  lines={stampLines(stamp.details)}
                  textWidth={stamp.textWidth}
                  textHeight={stamp.textHeight}
                  stampImageUrl={stamp.imageUrl}
                  initial={item.stamp_x !== null && item.stamp_y !== null ? { x: item.stamp_x, y: item.stamp_y, scale: item.stamp_scale ?? 1 } : null}
                />
              ) : null
            }
          />
          {/* Only on the checklist the approval is built from — leaving a
              document out of an approval means nothing anywhere else. */}
          {partOfApproval && <ApprovalInclusionToggle />}
        </div>

        <details className="mt-3">
          <summary className="text-xs text-muted cursor-pointer hover:text-heading">Document details (prepared by, reference no., revision, date)</summary>
          <DocumentDetailsForm item={item} jobId={jobId} />
        </details>

        <AmendmentsList itemId={item.id} jobId={jobId} amendments={item.amendments} />
      </ItemCard>
    </ItemStatusProvider>
  );
}
