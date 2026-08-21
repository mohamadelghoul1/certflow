import { formatISODate, stageComplete, pathwayCertRef } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { reportPathwayToPortal, uploadPathwayApproval, setVisiblePathwayVersion, startModification, uploadModificationApproval, notifyClientMessage } from "@/lib/actions/jobs";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { ChecklistSection } from "@/components/certifier/ChecklistSection";
import { IssueCertificateForm, IssueModificationForm } from "@/components/certifier/IssueCertificateForm";
import { DeletePathwayVersionButton } from "@/components/certifier/DeletePathwayVersionButton";
import Link from "next/link";
import type { Job, Certifier, Modification, ChecklistItem, Amendment, PathwayCertificateVersion } from "@/types/db";

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
  versions,
}: {
  job: Job;
  firmId: string;
  pathwayChecklistId: string;
  pathwayItems: ItemWithAmendments[];
  certifiers: Certifier[];
  modifications: ModificationWithChecklist[];
  library: LibItem[];
  versions: PathwayCertificateVersion[];
}) {
  const complete = stageComplete(pathwayItems);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-heading mb-2">{job.pathway} checklist</div>
        <ChecklistSection jobId={job.id} firmId={firmId} checklistId={pathwayChecklistId} label={job.pathway} library={library} items={pathwayItems} />
      </div>

      <div className="border border-line rounded-xl p-6 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-1">
          <div className="text-base font-semibold text-heading">{job.pathway}</div>
          {!complete && !job.pathway_generated && <span className="text-xs text-muted">Checklist not yet complete</span>}
          {job.pathway_generated && (
            <Link href={`/certificate/pathway/${job.id}`} target="_blank" className="text-xs font-semibold text-secondary hover:underline shrink-0">
              View certificate document →
            </Link>
          )}
        </div>
        <p className="text-xs text-muted mb-1">
          Regenerating keeps every earlier version below — nothing is overwritten. Pick which one clients see, or delete a version issued by mistake.
        </p>

        {complete && <IssueCertificateForm jobId={job.id} assignedCertifierId={job.assigned_certifier_id} certifiers={certifiers} isRegenerate={job.pathway_generated} />}

        {job.pathway_generated && (
          <div className="mt-3 flex items-center gap-4">
            <form action={reportPathwayToPortal}>
              <input type="hidden" name="job_id" value={job.id} />
              <button disabled={job.pathway_portal_reported} className="text-xs font-semibold text-slate-600 hover:underline disabled:opacity-50 disabled:cursor-default">
                {job.pathway_portal_reported ? `Reported to Portal ${formatISODate(job.pathway_portal_reported_date)}` : "Report to NSW Planning Portal"}
              </button>
            </form>
            {job.pathway_approval_uploaded && (
              <form action={notifyClientMessage}>
                <input type="hidden" name="job_id" value={job.id} />
                <input type="hidden" name="subject" value="Certificate issued" />
                <input type="hidden" name="message" value="Your certificate has been issued and is now available to view in your portal." />
                <button className="text-xs font-semibold text-secondary hover:underline">Notify client</button>
              </form>
            )}
          </div>
        )}

        {versions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            {versions.map((v) => (
              <PathwayVersionCard key={v.id} version={v} job={job} firmId={firmId} certifiers={certifiers} />
            ))}
          </div>
        )}
      </div>

      {job.pathway_generated && (
        <div>
          <div className="text-sm font-semibold text-heading mb-2">Modifications</div>
          <div className="space-y-4">
            {modifications.map((m) => (
              <ModificationCard key={m.id} mod={m} job={job} firmId={firmId} certifiers={certifiers} library={library} />
            ))}
            <form action={startModification} className="flex items-center gap-2">
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="pathway" value={job.pathway} />
              <input name="reason" placeholder="Reason for modification…" className="flex-1 px-2 py-1.5 rounded border border-line text-xs" />
              <button className="text-xs font-semibold text-secondary hover:underline">Start a modified {job.pathway}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

async function PathwayVersionCard({ version, job, firmId, certifiers }: { version: PathwayCertificateVersion; job: Job; firmId: string; certifiers: Certifier[] }) {
  const issuedBy = certifiers.find((c) => c.id === version.issued_by);
  const approvalUrl = await signedUrl(version.approval_file_path);
  const ref = pathwayCertRef(job.pathway, job.details?.projectNumber || job.id.slice(0, 8), version.version);

  return (
    <div className={`border rounded-xl p-4 ${version.visible_to_client ? "border-emerald-300 bg-emerald-50/40" : "border-line bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-heading">
            v{version.version} — {ref}
          </div>
          <div className="text-xs text-muted mt-0.5">
            Issued {formatISODate(version.generated_date)} by {issuedBy?.name || "—"}
            {version.signed_at ? ` · Signed ${formatISODate(version.signed_at)}` : " · Not yet signed"}
          </div>
        </div>
        {version.visible_to_client ? (
          <span className="text-[11px] font-semibold text-emerald-700 shrink-0">Shown to client</span>
        ) : (
          <form action={setVisiblePathwayVersion}>
            <input type="hidden" name="job_id" value={job.id} />
            <input type="hidden" name="version_id" value={version.id} />
            <button className="text-[11px] font-semibold text-secondary hover:underline shrink-0">Show this to client instead</button>
          </form>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {approvalUrl && (
          <a href={approvalUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">
            View signed approval
          </a>
        )}
        <ActionUpload
          action={uploadPathwayApproval}
          fields={{ job_id: job.id, version_id: version.id }}
          pathPrefix={`${firmId}/${job.id}/certificates/pathway/${version.id}`}
          label={version.approval_uploaded ? "Replace signed approval" : "Upload signed approval"}
        />
        <DeletePathwayVersionButton jobId={job.id} versionId={version.id} versionLabel={`v${version.version}`} />
      </div>
    </div>
  );
}

async function ModificationCard({ mod, job, firmId, certifiers, library }: { mod: ModificationWithChecklist; job: Job; firmId: string; certifiers: Certifier[]; library: LibItem[] }) {
  const complete = stageComplete(mod.items);
  const issuedBy = certifiers.find((c) => c.id === mod.issued_by);
  const approvalUrl = await signedUrl(mod.approval_file_path);

  return (
    <div className="border border-line rounded-xl p-6 shadow-sm bg-white">
      <div className="text-base font-semibold text-heading">Modification {mod.reason ? `— ${mod.reason}` : ""}</div>
      <div className="text-xs text-muted mt-0.5">{mod.generated ? `Issued ${formatISODate(mod.generated_date)} by ${issuedBy?.name || "—"} (v${mod.version})` : "Checklist in progress"}</div>

      {mod.checklistId && (
        <div className="mt-3">
          <ChecklistSection jobId={job.id} firmId={firmId} checklistId={mod.checklistId} label={`Modification${mod.reason ? ` — ${mod.reason}` : ""}`} library={library} items={mod.items} />
        </div>
      )}

      {complete && !mod.generated && <IssueModificationForm jobId={job.id} modificationId={mod.id} assignedCertifierId={job.assigned_certifier_id} certifiers={certifiers} />}

      {mod.generated && (
        <div className="mt-3 flex items-center gap-4">
          {approvalUrl && (
            <a href={approvalUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">
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
              <button className="text-xs font-semibold text-secondary hover:underline">Notify client</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
