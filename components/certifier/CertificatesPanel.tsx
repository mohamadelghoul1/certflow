import { formatISODate, stageComplete, resolvePathwayCertRef, portalRefKindFor } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { setVisiblePathwayVersion, startModification, uploadModificationApproval, uploadPathwayApproval, notifyClientMessage } from "@/lib/actions/jobs";
import { NotifyClientButton } from "@/components/certifier/NotifyClientButton";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { ChecklistSection } from "@/components/certifier/ChecklistSection";
import { buildStampPreview } from "@/lib/pdf/stampDetails";
import { PlanningPortalRefField } from "@/components/certifier/PlanningPortalRefField";
import { PreInspectionField } from "@/components/certifier/PreInspectionField";
import { IssueCertificateForm, IssueModificationForm } from "@/components/certifier/IssueCertificateForm";
import { DeletePathwayVersionButton } from "@/components/certifier/DeletePathwayVersionButton";
import { DeleteModificationButton } from "@/components/certifier/DeleteModificationButton";
import { EditableCertRef } from "@/components/certifier/EditableCertRef";
import { ApprovalSigningProvider, VersionCard, VersionSignedLabel, VersionSignedBadge, VersionSignActions, SendToClientWhenSigned } from "@/components/certifier/ApprovalSigning";
import Link from "next/link";
import { ChevronDown, Download, FileText } from "lucide-react";
import type { Job, Certifier, Modification, ChecklistItem, Amendment, PathwayCertificateVersion } from "@/types/db";
import { SubmitButton } from "@/components/SubmitButton";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[] };
type ModificationWithChecklist = Modification & { checklistId: string | null; items: ItemWithAmendments[] };
type LibItem = { id: string; title: string; description: string | null; category: string | null; template_file_path: string | null };

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
  // What the stamp will say and how big it is, worked out once for the
  // whole checklist rather than per document.
  const activeVersion = versions.find((v) => v.version === job.pathway_version);
  const portalRef = job.details?.certificateDetails?.planningPortalRef || "";
  const stamp = await buildStampPreview(job, activeVersion?.cert_ref);

  // A PC/OC job's approval was issued by another certifier: this firm has
  // nothing to assess or sign here. The checklist stays so their approval
  // and stamped plans can be filed against the job, and everything that
  // would issue a certificate of ours is left out.
  const prior = job.details?.priorApproval;
  if (job.pathway === "PC_OC") {
    return (
      <div className="space-y-6">
        <div className="border border-line rounded-xl p-6 shadow-sm bg-white">
          <div className="text-base font-semibold text-heading mb-1">Previously issued approval</div>
          <p className="text-xs text-muted mb-3">
            This firm is appointed as Principal Certifier only, so no {prior?.type || "CDC/CC"} is issued here. Record the approval on the Details tab; it is
            what the inspections are carried out under and what the Occupation Certificate is issued against.
          </p>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1.5 pr-4 font-semibold text-heading w-1/3">Approval</td>
                <td className="py-1.5 text-muted">{prior?.type || "—"}</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 font-semibold text-heading">Number</td>
                <td className="py-1.5 text-muted">{prior?.number || "— not yet recorded"}</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 font-semibold text-heading">Date issued</td>
                <td className="py-1.5 text-muted">{prior?.date ? formatISODate(prior.date) : "—"}</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 font-semibold text-heading">Issued by</td>
                <td className="py-1.5 text-muted">{prior?.issuedBy || "—"}</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 font-semibold text-heading">Planning Portal reference</td>
                <td className="py-1.5 text-muted">{prior?.portalRef || "— not yet recorded"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div className="text-sm font-semibold text-heading mb-2">Approval documents</div>
          <p className="text-xs text-muted mb-2">The approved plans and documents issued with that certificate — file them here so the inspections and the Occupation Certificate can refer to them.</p>
          <ChecklistSection jobId={job.id} firmId={firmId} checklistId={pathwayChecklistId} label="Approval" library={library} items={pathwayItems} stamp={stamp} partOfApproval />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-heading mb-2">{job.pathway} checklist</div>
        <ChecklistSection jobId={job.id} firmId={firmId} checklistId={pathwayChecklistId} label={job.pathway} library={library} items={pathwayItems} stamp={stamp} partOfApproval />
      </div>

      <ApprovalSigningProvider jobId={job.id} signedAt={job.pathway_signed_at}>
        <div className="border border-line rounded-xl p-6 shadow-sm bg-white">
          <div className="flex items-center justify-between mb-1">
            <div className="text-base font-semibold text-heading">{job.pathway}</div>
            {!complete && !job.pathway_generated && <span className="text-xs text-muted">Checklist not yet complete</span>}
          </div>
          <p className="text-xs text-muted mb-1">
            Regenerating keeps every earlier version below — nothing is overwritten. Pick which one is active, or delete a version issued by mistake. A
            version only reaches the client once you sign it and press Send to client.
          </p>

          {complete && (
            <>
              <PlanningPortalRefField jobId={job.id} value={portalRef} kind={portalRefKindFor(job.pathway)} />
              {/* The pre-inspection that precedes the certificate — the two
                  dates it needs, and a link to the report itself. */}
              <PreInspectionField
                jobId={job.id}
                isCdc={job.pathway === "CDC"}
                applicationDate={job.details?.preInspection?.applicationDate || ""}
                inspectionDate={job.details?.preInspection?.inspectionDate || ""}
              />
              <IssueCertificateForm
                jobId={job.id}
                assignedCertifierId={job.assigned_certifier_id}
                certifiers={certifiers}
                isRegenerate={job.pathway_generated}
                hasPortalRef={portalRef.trim().length > 0}
              />
            </>
          )}

          {job.pathway_generated && (
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              {job.pathway_sent_to_client ? (
                <span className="text-xs font-semibold text-success">Sent to client {formatISODate(job.pathway_sent_to_client_date)}</span>
              ) : (
                <SendToClientWhenSigned jobId={job.id} approvalUploaded={!!job.pathway_approval_uploaded} />
              )}
              {job.pathway_sent_to_client && (
                <NotifyClientButton
                  action={notifyClientMessage}
                  label="Notify client again"
                  fields={{
                    job_id: job.id,
                    subject: "Certificate issued",
                    message: "Your certificate has been issued and is now available to view in your portal.",
                  }}
                />
              )}
            </div>
          )}

          {versions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line space-y-3">
              {versions.map((v) => (
                <PathwayVersionCard key={v.id} version={v} job={job} firmId={firmId} certifiers={certifiers} />
              ))}
            </div>
          )}
        </div>
      </ApprovalSigningProvider>

      {job.pathway_generated && (
        <div>
          <div className="text-sm font-semibold text-heading mb-2">Modifications</div>
          <div className="space-y-4">
            {modifications.map((m) => (
              <ModificationCard key={m.id} mod={m} job={job} firmId={firmId} certifiers={certifiers} library={library} />
            ))}
            <form action={startModification} className="flex items-center gap-2">
              <input type="hidden" name="job_id" value={job.id} />
              <input name="reason" placeholder="Reason for modification…" className="flex-1 px-2 py-1.5 rounded border border-line text-xs" />
              <SubmitButton className="text-xs font-semibold text-secondary hover:underline">Start a modified {job.pathway}</SubmitButton>
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
  const ref = resolvePathwayCertRef(version.cert_ref, job.pathway, job.details?.projectNumber || job.id.slice(0, 8), version.version);

  return (
    <VersionCard isActive={!!version.visible_to_client} signedAt={version.signed_at}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-heading">
            v{version.version} — <EditableCertRef jobId={job.id} recordId={version.id} kind="pathway" currentRef={ref} isCustom={!!version.cert_ref} />
          </div>
          <div className="text-xs text-muted mt-0.5">
            Issued {formatISODate(version.generated_date)} by {issuedBy?.name || "—"}
            <VersionSignedLabel isActive={!!version.visible_to_client} signedAt={version.signed_at} />
            {version.sent_to_client ? ` · Sent to client ${formatISODate(version.sent_to_client_date)}` : " · Not sent to client"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {/* Green means approved, consistently with the checklist items —
              and a certificate is only approved once it's been signed. The
              active-version marker is a separate idea (which version the
              client sees), so it reads as a plain tag rather than competing
              for the same colour. */}
          <VersionSignedBadge isActive={!!version.visible_to_client} signedAt={version.signed_at} />
          {version.visible_to_client ? (
            <span className="text-[11px] text-muted">Active version</span>
          ) : (
            <form action={setVisiblePathwayVersion}>
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="version_id" value={version.id} />
              <SubmitButton className="text-[11px] font-semibold text-secondary hover:underline">Make this the active version</SubmitButton>
            </form>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center gap-3">
        {/* Everything that renders a document is limited to the active
            version: every route below builds from whichever version the job
            currently points at, so offering them on an older card would
            quietly produce the wrong document. Export stays available after
            signing — the document page hides its own Export at that point,
            which otherwise left no way to download the final approval.
            There is deliberately no browser-print option here: the approval
            leaves Certlyn as the Word export or as the full approved set
            PDF, both of which are laid out by Certlyn itself rather than
            by whatever the certifier's browser and printer driver decide. */}
        {version.visible_to_client && (
          <>
            <Link href={`/certificate/pathway/${job.id}`} target="_blank" className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
              <FileText size={12} /> Review approval
            </Link>
            <a href={`/api/certificate/pathway/${job.id}/word`} className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
              <Download size={12} /> Export to Word
            </a>
            {/* One PDF holding the signed approval and every approved
                document behind it, stamped where the checklist says so —
                the set that actually gets handed on. Only offered once
                the approval is signed, since an unsigned bundle isn't a
                set anyone should be circulating. */}
            <VersionSignActions jobId={job.id} isActive={!!version.visible_to_client} signedAt={version.signed_at} />
          </>
        )}
        {/* Closes the Export → edit in Word → bring it back loop on the card
            itself, so the whole issue/review/sign flow stays in one place
            instead of sending you to the document page just to upload.
            Stays available after signing, for a late correction. */}
        <ActionUpload
          action={uploadPathwayApproval}
          fields={{ job_id: job.id, version_id: version.id }}
          pathPrefix={`${firmId}/${job.id}/certificates/pathway/${version.id}`}
          label={version.approval_uploaded ? "Replace edited copy" : "Upload edited copy"}
        />
        {approvalUrl && (
          <a href={approvalUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">
            View uploaded copy
          </a>
        )}
        <DeletePathwayVersionButton jobId={job.id} versionId={version.id} versionLabel={`v${version.version}`} />
      </div>
    </VersionCard>
  );
}

async function ModificationCard({ mod, job, firmId, certifiers, library }: { mod: ModificationWithChecklist; job: Job; firmId: string; certifiers: Certifier[]; library: LibItem[] }) {
  const complete = stageComplete(mod.items);
  const issuedBy = certifiers.find((c) => c.id === mod.issued_by);
  const approvalUrl = await signedUrl(mod.approval_file_path);

  return (
    // Collapsed by default. Each modification carries a full document
    // checklist, so a job with even one or two of them made this tab
    // enormously long to scroll — and one started by mistake could never be
    // folded out of the way. Native <details> rather than a client-side
    // toggle keeps this a Server Component, matching the collapsibles
    // already used in ChecklistSection and TaskBoard.
    <details className="group border border-line rounded-xl shadow-sm bg-white">
      <summary className="flex items-start justify-between gap-3 p-6 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <div>
          <div className="text-base font-semibold text-heading">Modification {mod.reason ? `— ${mod.reason}` : ""}</div>
          {/* Nothing under the title until there's something real to report:
              an unissued modification is self-evidently still in progress, so
              saying so just added a line of noise to every card. */}
          {mod.generated && (
            <div className="text-xs text-muted mt-0.5">
              Issued {formatISODate(mod.generated_date)} by {issuedBy?.name || "—"} (v{mod.version})
            </div>
          )}
        </div>
        <ChevronDown className="w-5 h-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div className="px-6 pb-6">
        {mod.checklistId && (
          <ChecklistSection jobId={job.id} firmId={firmId} checklistId={mod.checklistId} label={`Modification${mod.reason ? ` — ${mod.reason}` : ""}`} library={library} items={mod.items} />
        )}

        {complete && !mod.generated && (
          <>
            <PlanningPortalRefField jobId={job.id} value={job.details?.certificateDetails?.planningPortalRef || ""} kind={portalRefKindFor(job.pathway)} />
            <IssueModificationForm
              jobId={job.id}
              modificationId={mod.id}
              assignedCertifierId={job.assigned_certifier_id}
              certifiers={certifiers}
              hasPortalRef={(job.details?.certificateDetails?.planningPortalRef || "").trim().length > 0}
            />
          </>
        )}

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
              <NotifyClientButton
                action={notifyClientMessage}
                label="Notify client"
                fields={{
                  job_id: job.id,
                  subject: "Modified certificate issued",
                  message: "A modified certificate has been issued and is now available to view in your portal.",
                }}
              />
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-line">
          <DeleteModificationButton jobId={job.id} modificationId={mod.id} label={`Modification${mod.reason ? ` — ${mod.reason}` : ""}`} generated={mod.generated} />
        </div>
      </div>
    </details>
  );
}
