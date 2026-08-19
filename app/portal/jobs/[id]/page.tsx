import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { displayStatus, unresolvedCount, checklistProgress, formatISODate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { UploadClientDocument } from "@/components/portal/UploadClientDocument";
import { BookInspectionForm } from "@/components/portal/BookInspectionForm";
import type { ChecklistItem, Amendment, Certifier, Inspection, Defect, OcRecord } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[] };

const OUTCOME_META: Record<string, { label: string; style: string }> = {
  pending: { label: "Pending", style: "bg-slate-100 text-slate-600" },
  passed: { label: "Passed", style: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", style: "bg-red-50 text-red-700" },
  passed_subject_to: { label: "Passed subject to", style: "bg-amber-50 text-amber-700" },
};

export default async function PortalJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile("client");
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) notFound();

  const [{ data: checklists }, { data: modifications }, { data: ocRecords }, { data: inspections }, { data: certifiers }] = await Promise.all([
    supabase.from("checklists").select("id, kind, modification_id, checklist_items(*, amendments(*))").eq("job_id", id),
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

  return (
    <div className="space-y-8">
      <div>
        <Link href="/portal" className="text-xs text-slate-400 hover:text-teal-800">
          ← All projects
        </Link>
        <h1 className="text-xl font-bold text-teal-900 mt-1">{job.address}</h1>
        <div className="text-sm text-slate-500">
          {job.pathway} · {job.description}
        </div>
      </div>

      <StageSection
        title={`Original ${job.pathway}`}
        items={(pathwayChecklist?.checklist_items as ItemWithAmendments[]) || []}
        jobId={id}
        firmId={job.firm_id}
      />

      {job.pathway_generated && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="font-bold text-teal-900 mb-1">{job.pathway} certificate issued</div>
          <div className="text-xs text-slate-500 mb-3">Issued {formatISODate(job.pathway_generated_date)}</div>
          {job.pathway_approval_uploaded && pathwayApprovalUrl ? (
            <a href={pathwayApprovalUrl} target="_blank" rel="noreferrer" className="text-sm text-teal-800 font-semibold hover:underline">
              Download certificate
            </a>
          ) : (
            <div className="text-xs text-slate-400">Signed certificate not yet uploaded by your certifier.</div>
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
          footer={m.generated ? `Issued ${formatISODate(m.generated_date)}` : undefined}
        />
      ))}

      <StageSection title="Notice of Commencement (NOC)" items={(nocChecklist?.checklist_items as ItemWithAmendments[]) || []} jobId={id} firmId={job.firm_id} />

      <InspectionsSection jobId={id} firmId={job.firm_id} pathwayGenerated={job.pathway_generated} inspections={(inspections as (Inspection & { defects: Defect[] })[]) || []} certifiers={certifiers || []} />

      <StageSection title="Occupation Certificate — checklist" items={(ocChecklist?.checklist_items as ItemWithAmendments[]) || []} jobId={id} firmId={job.firm_id} />

      <OcSection ocRecords={ocRecords || []} />

      <div className="text-[11px] text-slate-400 text-center">Signed in as {profile.email}</div>
    </div>
  );
}

async function StageSection({ title, items, jobId, firmId, footer }: { title: string; items: ItemWithAmendments[]; jobId: string; firmId: string; footer?: string }) {
  if (items.length === 0) return null;
  const progress = checklistProgress(items);

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="font-bold text-teal-900">{title}</div>
        {progress && <span className="text-xs text-slate-400">{progress} approved</span>}
      </div>
      <div className="p-5 space-y-3">
        {items.map((item) => {
          const status = displayStatus(item);
          const unresolved = item.amendments.filter((a) => !a.resolved);
          return (
            <div key={item.id} className="border border-slate-100 rounded-md p-4">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                <span className="text-sm font-semibold text-teal-900">{item.title}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
              <div className="text-xs mt-1 font-medium text-slate-600">{status.label}</div>

              {unresolved.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {unresolved.map((a) => (
                    <div key={a.id} className="text-xs bg-amber-50 text-amber-800 rounded-md px-3 py-2">
                      {a.text}
                    </div>
                  ))}
                </div>
              )}

              {item.status !== "approved" && (
                <div className="mt-2">
                  <UploadClientDocument itemId={item.id} pathPrefix={`${firmId}/${jobId}/checklist/${item.id}`} hasFile={!!item.file_path} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {footer && <div className="px-5 pb-4 text-xs text-emerald-700">{footer}</div>}
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
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">Inspections</div>
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
    <div className="border border-slate-100 rounded-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-teal-900">{insp.title}</div>
          <div className="text-xs text-slate-500">{insp.description}</div>
          {insp.date && <div className="text-xs text-slate-600 mt-1">Scheduled: {formatISODate(insp.date)}</div>}
          {inspectorName && <div className="text-xs text-slate-400">Inspector: {inspectorName}</div>}
        </div>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${meta.style}`}>{meta.label}</span>
      </div>

      {insp.defects.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {insp.defects.map((d) => (
            <div key={d.id} className={`text-xs rounded-md px-3 py-2 ${d.resolved ? "bg-slate-50 text-slate-400 line-through" : "bg-amber-50 text-amber-800"}`}>
              {d.text}
            </div>
          ))}
        </div>
      )}

      {canBook && (
        <div className="mt-3">
          <BookInspectionForm inspectionId={insp.id} jobId={jobId} />
          <div className="text-[11px] text-slate-400 mt-1">Weekend dates aren&apos;t available — we&apos;ll suggest the next working day automatically.</div>
        </div>
      )}
      {insp.booked_by_client && !insp.confirmed && <div className="text-xs text-amber-700 mt-2">Awaiting confirmation from your certifier.</div>}

      {insp.report_sent && reportUrl && (
        <a href={reportUrl} target="_blank" rel="noreferrer" className="inline-block mt-3 text-xs text-teal-800 font-semibold hover:underline">
          View inspection report
        </a>
      )}
    </div>
  );
}

async function OcSection({ ocRecords }: { ocRecords: OcRecord[] }) {
  if (ocRecords.length === 0) return null;
  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">Occupation Certificates</div>
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
    <div className="border border-slate-100 rounded-md p-4">
      <div className="text-sm font-semibold text-teal-900">
        {record.type === "whole" ? "Whole OC" : "Partial OC"} {record.description ? `— ${record.description}` : ""}
      </div>
      <div className="text-xs text-slate-500">Issued {formatISODate(record.generated_date)}</div>
      {record.approval_uploaded && url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-teal-800 font-semibold hover:underline">
          Download certificate
        </a>
      ) : (
        <div className="text-xs text-slate-400 mt-2">Signed certificate not yet available.</div>
      )}
    </div>
  );
}
