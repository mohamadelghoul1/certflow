import { formatISODate, stageComplete } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { uploadOcApproval, reportOcToPortal, markJobComplete, reopenJob, notifyClientMessage } from "@/lib/actions/jobs";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { ChecklistSection } from "@/components/certifier/ChecklistSection";
import { IssueOcForm } from "@/components/certifier/IssueOcForm";
import type { Job, Certifier, OcRecord, ChecklistItem, Amendment } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[] };
type LibItem = { title: string; description: string | null; category: string | null };

export async function OcPanel({
  job,
  firmId,
  checklistId,
  items,
  certifiers,
  ocRecords,
  library,
}: {
  job: Job;
  firmId: string;
  checklistId: string;
  items: ItemWithAmendments[];
  certifiers: Certifier[];
  ocRecords: OcRecord[];
  library: LibItem[];
}) {
  const complete = stageComplete(items);
  const hasWhole = ocRecords.some((r) => r.type === "whole");

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-heading mb-2">OC checklist</div>
        <ChecklistSection jobId={job.id} firmId={firmId} checklistId={checklistId} label="Occupation Certificate" library={library} items={items} />
      </div>

      {!job.pathway_generated && <div className="text-xs text-muted">Occupation Certificates can&apos;t be issued until the {job.pathway} is issued.</div>}

      {job.pathway_generated && complete && <IssueOcForm jobId={job.id} assignedCertifierId={job.assigned_certifier_id} certifiers={certifiers} />}

      <div className="space-y-3">
        {ocRecords.map((r) => (
          <OcRecordCard key={r.id} record={r} job={job} firmId={firmId} certifiers={certifiers} />
        ))}
      </div>

      {hasWhole && job.status !== "complete" && (
        <form action={markJobComplete}>
          <input type="hidden" name="job_id" value={job.id} />
          <button className="text-sm font-medium text-white bg-secondary hover:opacity-90 px-4 py-1.5 rounded-full">Mark project complete</button>
        </form>
      )}
      {job.status === "complete" && (
        <form action={reopenJob}>
          <input type="hidden" name="job_id" value={job.id} />
          <button className="text-xs text-muted hover:underline">Reopen project</button>
        </form>
      )}
    </div>
  );
}

async function OcRecordCard({ record, job, firmId, certifiers }: { record: OcRecord; job: Job; firmId: string; certifiers: Certifier[] }) {
  const issuedBy = certifiers.find((c) => c.id === record.issued_by);
  const approvalUrl = await signedUrl(record.approval_file_path);
  return (
    <div className="card-lift border border-line rounded-xl p-6 shadow-sm bg-white">
      <div className="text-base font-semibold text-heading">
        {record.type === "whole" ? "Whole OC" : "Partial OC"} {record.description ? `— ${record.description}` : ""}
      </div>
      <div className="text-xs text-muted mt-0.5">
        Issued {formatISODate(record.generated_date)} by {issuedBy?.name || "—"}
      </div>
      <div className="mt-3 flex items-center gap-4">
        {approvalUrl && (
          <a href={approvalUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">
            View signed approval
          </a>
        )}
        <ActionUpload
          action={uploadOcApproval}
          fields={{ job_id: job.id, oc_id: record.id }}
          pathPrefix={`${firmId}/${job.id}/certificates/oc/${record.id}`}
          label={record.approval_uploaded ? "Replace signed approval" : "Upload signed approval"}
        />
        {record.approval_uploaded && (
          <form action={notifyClientMessage}>
            <input type="hidden" name="job_id" value={job.id} />
            <input type="hidden" name="subject" value="Occupation Certificate issued" />
            <input type="hidden" name="message" value={`Your ${record.type === "whole" ? "Whole" : "Partial"} Occupation Certificate has been issued and is now available to view in your portal.`} />
            <button className="text-xs font-semibold text-secondary hover:underline">Notify client</button>
          </form>
        )}
        <form action={reportOcToPortal}>
          <input type="hidden" name="job_id" value={job.id} />
          <input type="hidden" name="oc_id" value={record.id} />
          <button disabled={record.portal_reported} className="text-xs font-semibold text-slate-600 hover:underline disabled:opacity-50 disabled:cursor-default">
            {record.portal_reported ? `Reported to Portal ${formatISODate(record.portal_reported_date)}` : "Report to NSW Planning Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}
