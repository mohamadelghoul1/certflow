import { pathwayLabel } from "@/lib/business";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { StageTabs } from "@/components/portal/StageTabs";
import { displayStatus, unresolvedCount, checklistProgress, formatISODate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { ClientItemDocuments } from "@/components/portal/ClientItemDocuments";
import { BookInspectionForm } from "@/components/portal/BookInspectionForm";
import type { ChecklistItem, Amendment, ChecklistItemFile, Certifier, Inspection, Defect, OcRecord } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[]; checklist_item_files?: ChecklistItemFile[] | null };

const OUTCOME_META: Record<string, { label: string; style: string }> = {
  pending: { label: "Pending", style: "bg-surface text-muted" },
  passed: { label: "Passed", style: "bg-success-bg text-success" },
  failed: { label: "Failed", style: "bg-error-bg text-error" },
  passed_subject_to: { label: "Satisfactory (minor issues) subject to documents being provided", style: "bg-warning-bg text-warning-text" },
};

export default async function PortalJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { id } = await params;
  const { stage: stageParam } = await searchParams;
  const { profile } = await requireProfile("client");
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  // A deleted project is gone as far as the client is concerned, even
  // though the certifier can still bring it back.
  if (!job || job.deleted_at) notFound();

  const [{ data: checklists }, { data: modifications }, { data: ocRecords }, { data: inspections }, { data: certifiers }] = await Promise.all([
    supabase
      .from("checklists")
      .select("id, kind, modification_id, checklist_items(*, amendments(*), checklist_item_files(*))")
      .eq("job_id", id)
      .order("sort_order", { referencedTable: "checklist_items" })
      .order("created_at", { referencedTable: "checklist_items" }),
    supabase.from("modifications").select("*").eq("job_id", id).order("created_at"),
    supabase.from("oc_records").select("*").eq("job_id", id).order("created_at"),
    supabase.from("inspections").select("*, defects(*)").eq("job_id", id),
    supabase.from("certifiers").select("*").eq("firm_id", job.firm_id),
  ]);

  const pathwayChecklist = (checklists || []).find((c) => c.kind === "pathway");
  const nocChecklist = (checklists || []).find((c) => c.kind === "noc");
  const ocChecklist = (checklists || []).find((c) => c.kind === "oc");
  const modChecklists = new Map((checklists || []).filter((c) => c.kind === "modification").map((c) => [c.modification_id, c]));

  const pathwayApprovalUrl = await signedUrl(job.pathway_approval_file_path);

  // Which of this project's documents the firm has a blank form for.
  // Checklist items link to a library item whether or not a form has been
  // attached to it, and the document library isn't readable by a client at
  // all, so the check is made here with the admin client rather than by
  // offering a link that turns out to lead nowhere.
  const linkedLibraryIds = [
    ...new Set(
      (checklists || [])
        .flatMap((c) => (c.checklist_items as ItemWithAmendments[]) || [])
        .map((i) => i.template_library_item_id)
        .filter((id): id is string => !!id)
    ),
  ];
  const formIds = new Set<string>();
  if (linkedLibraryIds.length > 0) {
    const { data: withForms } = await createAdminClient()
      .from("document_library_items")
      .select("id")
      .in("id", linkedLibraryIds)
      .not("template_file_path", "is", null);
    for (const row of withForms || []) formIds.add(row.id);
  }

  const pathwayItems = (pathwayChecklist?.checklist_items as ItemWithAmendments[]) || [];
  const nocItems = (nocChecklist?.checklist_items as ItemWithAmendments[]) || [];
  const ocItems = (ocChecklist?.checklist_items as ItemWithAmendments[]) || [];

  // The OC stage only opens once the Notice of Commencement is done —
  // every NOC item approved. A job whose certifier hasn't put anything on
  // the NOC checklist has nothing to complete, so it doesn't lock the OC.
  const nocComplete = nocItems.length > 0 && nocItems.every((i) => i.status === "approved");
  const ocLocked = nocItems.length > 0 && !nocComplete;

  // A PC/OC-only job has no CDC or CC: its pathway checklist is the PC
  // appointment paperwork, so the first tab says so.
  const approvalLabel = job.pathway === "PC_OC" ? "PC Appointment" : pathwayLabel(job.pathway);
  const stage = stageParam === "noc" || stageParam === "oc" ? stageParam : "approval";

  const tabs: { key: string; label: string; done: boolean; locked?: boolean }[] = [
    { key: "approval", label: approvalLabel, done: pathwayItems.length > 0 && pathwayItems.every((i) => i.status === "approved") },
    { key: "noc", label: "PC — Notice of Commencement", done: nocComplete },
    { key: "oc", label: "Occupation Certificate", done: (ocRecords || []).some((r) => r.sent_to_client), locked: ocLocked },
  ];

  const approvalPanel = (
        <div className="space-y-6">
          <StageSection title={`${approvalLabel} — checklist`} items={pathwayItems} jobId={id} firmId={job.firm_id} formIds={formIds} />
          {pathwayItems.length === 0 && !job.pathway_sent_to_client && <EmptyStage label={approvalLabel} />}

          {job.pathway_sent_to_client && (
            <div className="bg-white rounded-lg border border-line p-5">
              <div className="font-bold text-primary mb-1">{pathwayLabel(job.pathway)} certificate issued</div>
              <div className="text-xs text-placeholder mb-3">Issued {formatISODate(job.pathway_generated_date)}</div>
              {/* The certifier's own uploaded copy wins when there is one — it's
                  the version they actually edited and signed off. Falling back to
                  the generated certificate means a released certificate is always
                  downloadable: previously, forgetting to upload left the client
                  with nothing but "not yet uploaded", even though the certificate
                  had been issued and sent. */}
              {job.pathway_approval_uploaded && pathwayApprovalUrl ? (
                <a href={pathwayApprovalUrl} target="_blank" rel="noreferrer" className="text-sm text-primary font-semibold hover:underline">
                  Download certificate
                </a>
              ) : (
                <a href={`/api/portal/certificate/pathway/${job.id}/word`} className="text-sm text-primary font-semibold hover:underline">
                  Download certificate
                </a>
              )}
            </div>
          )}

          {(modifications || []).map((m) => (
            <StageSection
              key={m.id}
              title={`Modification${m.reason ? ` — ${m.reason}` : ""}`}
              items={(modChecklists.get(m.id)?.checklist_items as ItemWithAmendments[]) || []}
              jobId={id}
              firmId={job.firm_id}
              formIds={formIds}
              footer={m.generated ? `Issued ${formatISODate(m.generated_date)}` : undefined}
            />
          ))}
        </div>
  );

  const nocPanel = (
        <div className="space-y-6">
          <StageSection title="Notice of Commencement (NOC) — checklist" items={nocItems} jobId={id} firmId={job.firm_id} formIds={formIds} />
          {nocItems.length === 0 && <EmptyStage label="Notice of Commencement" />}

          <InspectionsSection jobId={id} firmId={job.firm_id} pathwayGenerated={job.pathway_generated} inspections={(inspections as (Inspection & { defects: Defect[] })[]) || []} certifiers={certifiers || []} />
        </div>
  );

  // Not rendered at all while locked — the lock panel lives in StageTabs.
  const ocPanel = ocLocked ? null : (
          <div className="space-y-6">
            <StageSection title="Occupation Certificate — checklist" items={ocItems} jobId={id} firmId={job.firm_id} formIds={formIds} />
            {ocItems.length === 0 && (ocRecords || []).filter((r) => r.sent_to_client).length === 0 && <EmptyStage label="Occupation Certificate" />}

            <OcSection ocRecords={(ocRecords || []).filter((r) => r.sent_to_client)} />
          </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal" className="text-xs text-placeholder hover:text-primary">
          ← All projects
        </Link>
        <h1 className="text-xl font-bold text-primary mt-1">{job.address}</h1>
        <div className="text-sm text-placeholder">
          {pathwayLabel(job.pathway)} · {job.description}
        </div>
      </div>

      <StageTabs
        tabs={tabs}
        initialStage={stage}
        ocLocked={ocLocked}
        nocProgress={checklistProgress(nocItems)}
        approval={approvalPanel}
        noc={nocPanel}
        oc={ocPanel}
      />

      <div className="text-[11px] text-placeholder text-center">Signed in as {profile.email}</div>
    </div>
  );
}

function EmptyStage({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-lg border border-line p-6 text-sm text-muted text-center">
      Nothing is needed from you for the {label} stage yet — your certifier will add items here when they are.
    </div>
  );
}

async function StageSection({
  title,
  items,
  jobId,
  firmId,
  formIds,
  footer,
}: {
  title: string;
  items: ItemWithAmendments[];
  jobId: string;
  firmId: string;
  // Library item ids that actually have a blank form attached.
  formIds: Set<string>;
  footer?: string;
}) {
  if (items.length === 0) return null;
  const progress = checklistProgress(items);

  return (
    <div className="bg-white rounded-lg border border-line">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <div className="font-bold text-primary">{title}</div>
        {progress && <span className="text-xs text-placeholder">{progress} approved</span>}
      </div>
      <div className="p-5 space-y-3">
        {items.map((item) => {
          const status = displayStatus(item);
          const unresolved = item.amendments.filter((a) => !a.resolved);
          // The card wears the document's state: blue once submitted and
          // waiting on the certifier, green once approved, an amber edge
          // while requested changes wait on the client (white inside so
          // the amber amendment notes on the card stay visible).
          const tone = status.dot.includes("emerald")
            ? "border-accent/40 bg-success-bg"
            : status.dot.includes("amber")
              ? "border-warning/60 bg-white"
              : status.dot.includes("blue")
                ? "border-info/40 bg-info-bg"
                : "border-line bg-white";
          return (
            <div key={item.id} className={`border rounded-md p-4 ${tone}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                <span className="text-sm font-semibold text-primary">{item.title}</span>
              </div>
              <div className="text-xs text-placeholder mt-0.5">{item.description}</div>
              <div className="text-xs mt-1 font-medium text-muted">{status.label}</div>

              {unresolved.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {unresolved.map((a) => (
                    <div key={a.id} className="text-xs bg-warning-bg text-warning-text rounded-md px-3 py-2">
                      {a.text}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-4">
                {/* The certifier's own blank form for this document, where
                    they've attached one: the contract, the application
                    form, the notice of commencement. Download it, fill it
                    in, and upload it back with the button beside it. */}
                {item.template_library_item_id && formIds.has(item.template_library_item_id) && (
                  <a
                    href={`/api/forms/${item.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline"
                  >
                    <Download size={14} /> Download blank form
                  </a>
                )}
              </div>

              {/* What has already been sent for this item — every document
                  on it, each with its own history, so a client can check
                  what the certifier is holding before sending more. */}
              <ClientItemDocuments item={item} jobId={jobId} firmId={firmId} canUpload={item.status !== "approved"} />
            </div>
          );
        })}
      </div>
      {footer && <div className="px-5 pb-4 text-xs text-success">{footer}</div>}
    </div>
  );
}

async function InspectionsSection({
  jobId,
  firmId,
  pathwayGenerated,
  inspections,
  certifiers,
}: {
  jobId: string;
  firmId: string;
  pathwayGenerated: boolean;
  inspections: (Inspection & { defects: Defect[] })[];
  certifiers: Certifier[];
}) {
  if (!pathwayGenerated) return null;
  void firmId;

  return (
    <div className="bg-white rounded-lg border border-line">
      <div className="px-5 py-3 border-b border-line font-bold text-primary">Inspections</div>
      <div className="p-5 space-y-3">
        {inspections.map((insp) => {
          const meta = OUTCOME_META[insp.outcome];
          const inspector = certifiers.find((c) => c.id === insp.inspector_certifier_id);
          return (
            <InspectionCard key={insp.id} insp={insp} jobId={jobId} meta={meta} inspectorName={inspector?.name} />
          );
        })}
      </div>
    </div>
  );
}

async function InspectionCard({ insp, jobId, meta, inspectorName }: { insp: Inspection & { defects: Defect[] }; jobId: string; meta: { label: string; style: string }; inspectorName?: string }) {
  const reportUrl = await signedUrl(insp.report_file_path);
  const canBook = insp.outcome === "pending";

  return (
    <div className="border border-line rounded-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-primary">{insp.title}</div>
          <div className="text-xs text-placeholder">{insp.description}</div>
          {insp.date && <div className="text-xs text-muted mt-1">Scheduled: {formatISODate(insp.date)}</div>}
          {inspectorName && <div className="text-xs text-placeholder">Inspector: {inspectorName}</div>}
        </div>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${meta.style}`}>{meta.label}</span>
      </div>

      {insp.defects.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {insp.defects.map((d) => (
            <div key={d.id} className={`text-xs rounded-md px-3 py-2 ${d.resolved ? "bg-surface text-placeholder line-through" : "bg-warning-bg text-warning-text"}`}>
              {d.text}
            </div>
          ))}
        </div>
      )}

      {canBook && (
        <div className="mt-3">
          <BookInspectionForm inspectionId={insp.id} jobId={jobId} />
          <div className="text-[11px] text-placeholder mt-1">Weekend dates aren&apos;t available — we&apos;ll suggest the next working day automatically.</div>
        </div>
      )}
      {insp.booked_by_client && !insp.confirmed && <div className="text-xs text-warning-text mt-2">Awaiting confirmation from your certifier.</div>}

      {insp.report_sent && reportUrl && (
        <a href={reportUrl} target="_blank" rel="noreferrer" className="inline-block mt-3 text-xs text-primary font-semibold hover:underline">
          View inspection report
        </a>
      )}
    </div>
  );
}

async function OcSection({ ocRecords }: { ocRecords: OcRecord[] }) {
  if (ocRecords.length === 0) return null;
  return (
    <div className="bg-white rounded-lg border border-line">
      <div className="px-5 py-3 border-b border-line font-bold text-primary">Occupation Certificates</div>
      <div className="p-5 space-y-3">
        {ocRecords.map((r) => (
          <OcRecordCard key={r.id} record={r} />
        ))}
      </div>
    </div>
  );
}

async function OcRecordCard({ record }: { record: OcRecord }) {
  const url = await signedUrl(record.approval_file_path);
  return (
    <div className="border border-line rounded-md p-4">
      <div className="text-sm font-semibold text-primary">
        {record.type === "whole" ? "Whole OC" : "Partial OC"} {record.description ? `— ${record.description}` : ""}
      </div>
      <div className="text-xs text-placeholder">Issued {formatISODate(record.generated_date)}</div>
      {record.approval_uploaded && url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-primary font-semibold hover:underline">
          Download certificate
        </a>
      ) : (
        <a href={`/api/portal/certificate/oc/${record.job_id}/${record.id}/word`} className="inline-block mt-2 text-xs text-primary font-semibold hover:underline">
          Download certificate
        </a>
      )}
    </div>
  );
}
