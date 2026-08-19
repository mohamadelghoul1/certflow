import { formatISODate, stageComplete, pathwayCertRef } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { issuePathwayCertificate, reportPathwayToPortal, uploadPathwayApproval, startModification, issueModification, uploadModificationApproval, notifyClientMessage } from "@/lib/actions/jobs";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { ChecklistSection } from "@/components/certifier/ChecklistSection";
import Link from "next/link";
import type { Job, Certifier, Modification, ChecklistItem, Amendment } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[] };
type ModificationWithChecklist = Modification & { checklistId: string | null; items: ItemWithAmendments[] };
type LibItem = { title: string; description: string | null; category: string | null };

export async function CertificatesPanel({
  job,
  firmId,
  pathwayChecklistId,
  pathwayItems,
  certifiers,
  modifications,
  library,
}: {
  job: Job;
  firmId: string;
  pathwayChecklistId: string;
  pathwayItems: ItemWithAmendments[];
  certifiers: Certifier[];
  modifications: ModificationWithChecklist[];
  library: LibItem[];
}) {
  const complete = stageComplete(pathwayItems);
  const issuedBy = certifiers.find((c) => c.id === job.pathway_issued_by);
  const approvalUrl = await signedUrl(job.pathway_approval_file_path);
  const ref = pathwayCertRef(job.pathway, job.details?.projectNumber || job.id.slice(0, 8), job.pathway_version);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-teal-900 mb-2">{job.pathway} checklist</div>
        <ChecklistSection jobId={job.id} firmId={firmId} checklistId={pathwayChecklistId} label={`Original ${job.pathway}`} library={library} items={pathwayItems} />
      </div>

      <div className="border border-slate-200 rounded-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-teal-900">Original {job.pathway} — {ref}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {job.pathway_generated ? `Issued ${formatISODate(job.pathway_generated_date)} by ${issuedBy?.name || "—"} (v${job.pathway_version})` : "Not yet issued"}
            </div>
          </div>
          {!complete && !job.pathway_generated && <span className="text-xs text-slate-400">Checklist not yet complete</span>}
          {job.pathway_generated && (
            <Link href={`/certificate/pathway/${job.id}`} target="_blank" className="text-xs font-semibold text-teal-800 hover:underline shrink-0">
              View certificate document →
            </Link>
          )}
        </div>

        {complete && (
          <form action={issuePathwayCertificate} className="mt-3 flex items-end gap-2">
            <input type="hidden" name="job_id" value={job.id} />
            <select name="certifier_id" defaultValue={job.assigned_certifier_id || ""} className="px-2 py-1.5 rounded border border-slate-200 text-xs">
              {certifiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-md">
              {job.pathway_generated ? "Regenerate certificate" : "Issue certificate"}
            </button>
          </form>
        )}

        {job.pathway_generated && (
          <div className="mt-3 flex items-center gap-4">
            {approvalUrl && (
              <a href={approvalUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-800 hover:underline">
                View signed approval
              </a>
            )}
            <ActionUpload
              action={uploadPathwayApproval}
              fields={{ job_id: job.id }}
              pathPrefix={`${firmId}/${job.id}/certificates/pathway`}
              label={job.pathway_approval_uploaded ? "Replace signed approval" : "Upload signed approval"}
            />
            {job.pathway_approval_uploaded && (
              <>
                <span className="text-[11px] text-emerald-700">Visible to client</span>
                <form action={notifyClientMessage}>
                  <input type="hidden" name="job_id" value={job.id} />
                  <input type="hidden" name="subject" value="Certificate issued" />
                  <input type="hidden" name="message" value="Your certificate has been issued and is now available to view in your portal." />
                  <button className="text-xs font-semibold text-teal-800 hover:underline">Notify client</button>
                </form>
              </>
            )}
            <form action={reportPathwayToPortal}>
              <input type="hidden" name="job_id" value={job.id} />
              <button disabled={job.pathway_portal_reported} className="text-xs font-semibold text-slate-600 hover:underline disabled:opacity-50 disabled:cursor-default">
                {job.pathway_portal_reported ? `Reported to Portal ${formatISODate(job.pathway_portal_reported_date)}` : "Report to NSW Planning Portal"}
              </button>
            </form>
          </div>
        )}
      </div>

      {job.pathway_generated && (
        <div>
          <div className="text-sm font-semibold text-teal-900 mb-2">Modifications</div>
          <div className="space-y-4">
            {modifications.map((m) => (
              <ModificationCard key={m.id} mod={m} job={job} firmId={firmId} certifiers={certifiers} library={library} />
            ))}
            <form action={startModification} className="flex items-center gap-2">
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="pathway" value={job.pathway} />
              <input name="reason" placeholder="Reason for modification…" className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-xs" />
              <button className="text-xs font-semibold text-teal-800 hover:underline">Start a modified {job.pathway}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

async function ModificationCard({ mod, job, firmId, certifiers, library }: { mod: ModificationWithChecklist; job: Job; firmId: string; certifiers: Certifier[]; library: LibItem[] }) {
  const complete = stageComplete(mod.items);
  const issuedBy = certifiers.find((c) => c.id === mod.issued_by);
  const approvalUrl = await signedUrl(mod.approval_file_path);

  return (
    <div className="border border-slate-200 rounded-md p-4">
      <div className="text-sm font-semibold text-teal-900">Modification {mod.reason ? `— ${mod.reason}` : ""}</div>
      <div className="text-xs text-slate-500 mt-0.5">{mod.generated ? `Issued ${formatISODate(mod.generated_date)} by ${issuedBy?.name || "—"} (v${mod.version})` : "Checklist in progress"}</div>

      {mod.checklistId && (
        <div className="mt-3">
          <ChecklistSection jobId={job.id} firmId={firmId} checklistId={mod.checklistId} label={`Modification${mod.reason ? ` — ${mod.reason}` : ""}`} library={library} items={mod.items} />
        </div>
      )}

      {complete && !mod.generated && (
        <form action={issueModification} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="job_id" value={job.id} />
          <input type="hidden" name="modification_id" value={mod.id} />
          <select name="certifier_id" defaultValue={job.assigned_certifier_id || ""} className="px-2 py-1.5 rounded border border-slate-200 text-xs">
            {certifiers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-md">Issue modification</button>
        </form>
      )}

      {mod.generated && (
        <div className="mt-3 flex items-center gap-4">
          {approvalUrl && (
            <a href={approvalUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-800 hover:underline">
              View signed approval
            </a>
          )}
          <ActionUpload
            action={uploadModificationApproval}
            fields={{ job_id: job.id, modification_id: mod.id }}
            pathPrefix={`${firmId}/${job.id}/certificates/modification/${mod.id}`}
            label={mod.approval_uploaded ? "Replace signed approval" : "Upload signed approval"}
          />
          {mod.approval_uploaded && (
            <form action={notifyClientMessage}>
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="subject" value="Modified certificate issued" />
              <input type="hidden" name="message" value="A modified certificate has been issued and is now available to view in your portal." />
              <button className="text-xs font-semibold text-teal-800 hover:underline">Notify client</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
