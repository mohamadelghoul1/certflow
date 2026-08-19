import { formatISODate, stageComplete } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { issueOc, uploadOcApproval, markJobComplete, reopenJob, notifyClientMessage } from "@/lib/actions/jobs";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { ChecklistSection } from "@/components/certifier/ChecklistSection";
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
        <div className="text-sm font-semibold text-teal-900 mb-2">OC checklist</div>
        <ChecklistSection jobId={job.id} firmId={firmId} checklistId={checklistId} label="Occupation Certificate" library={library} items={items} />
      </div>

      {!job.pathway_generated && <div className="text-xs text-slate-400">Occupation Certificates can&apos;t be issued until the original {job.pathway} is issued.</div>}

      {job.pathway_generated && complete && (
        <form action={issueOc} className="border border-slate-200 rounded-md p-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="job_id" value={job.id} />
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Type</label>
            <select name="type" className="px-2 py-1.5 rounded border border-slate-200 text-xs">
              <option value="partial">Partial OC</option>
              <option value="whole">Whole OC</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] text-slate-400 mb-1">Description (scope, for partials)</label>
            <input name="description" className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Certifier</label>
            <select name="certifier_id" defaultValue={job.assigned_certifier_id || ""} className="px-2 py-1.5 rounded border border-slate-200 text-xs">
              {certifiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button className="text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-md">Issue OC</button>
        </form>
      )}

      <div className="space-y-3">
        {ocRecords.map((r) => (
          <OcRecordCard key={r.id} record={r} job={job} firmId={firmId} certifiers={certifiers} />
        ))}
      </div>

      {hasWhole && job.status !== "complete" && (
        <form action={markJobComplete}>
          <input type="hidden" name="job_id" value={job.id} />
          <button className="text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 px-3 py-1.5 rounded-md">Mark job complete</button>
        </form>
      )}
      {job.status === "complete" && (
        <form action={reopenJob}>
          <input type="hidden" name="job_id" value={job.id} />
          <button className="text-xs text-slate-500 hover:underline">Reopen job</button>
        </form>
      )}
    </div>
  );
}

async function OcRecordCard({ record, job, firmId, certifiers }: { record: OcRecord; job: Job; firmId: string; certifiers: Certifier[] }) {
  const issuedBy = certifiers.find((c) => c.id === record.issued_by);
  const approvalUrl = await signedUrl(record.approval_file_path);
  return (
    <div className="border border-slate-200 rounded-md p-4">
      <div className="text-sm font-semibold text-teal-900">
        {record.type === "whole" ? "Whole OC" : "Partial OC"} {record.description ? `— ${record.description}` : ""}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">
        Issued {formatISODate(record.generated_date)} by {issuedBy?.name || "—"}
      </div>
      <div className="mt-3 flex items-center gap-4">
        {approvalUrl && (
          <a href={approvalUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-800 hover:underline">
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
            <button className="text-xs font-semibold text-teal-800 hover:underline">Notify client</button>
          </form>
        )}
      </div>
    </div>
  );
}
