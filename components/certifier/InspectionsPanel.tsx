import Link from "next/link";
import { FileText, Download, FileDown } from "lucide-react";
import { InspectionSigning, SignInspectionReportButton } from "@/components/certifier/SignInspectionReportButton";
import { formatISODate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import {
  assignInspector,
  confirmBooking,
  uploadInspectionReport,
  updateInspectionReportText,
  setPhotoCaption,
  removePhoto,
} from "@/lib/actions/inspections";
import { ReportToPortalButton } from "@/components/certifier/ReportToPortalButton";
import { portalConfigured } from "@/lib/portal/config";
import { INSPECTION_OUTCOME_TEXT } from "@/lib/constants";
import { notifyClientMessage } from "@/lib/actions/jobs";
import { NotifyClientButton } from "@/components/certifier/NotifyClientButton";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { InspectionPhotoUpload } from "@/components/certifier/InspectionPhotoUpload";
import { DownloadButton } from "@/components/certifier/DownloadButton";
import { InspectionOrderProvider, InspectionMoveButtons } from "@/components/certifier/InspectionOrder";
import { InspectionCardState, InspectionCardShell, OutcomeBadge, OutcomeSelect, InspectionDateBox, IssuesWhenNeeded, RemoveInspectionButton } from "@/components/certifier/InspectionCard";
import { AddInspectionForm } from "@/components/certifier/AddInspectionForm";
import { AutoSubmitSelect } from "@/components/certifier/AutoSubmitSelect";
import type { Inspection, Defect, InspectionPhoto, Certifier } from "@/types/db";

type InspectionWithDefects = Inspection & { defects: Defect[]; inspection_photos: InspectionPhoto[] };

export async function InspectionsPanel({
  jobId,
  firmId,
  inspections,
  certifiers,
  portalCaseRef = "",
  submitterEmail = "",
}: {
  jobId: string;
  firmId: string;
  inspections: InspectionWithDefects[];
  certifiers: Certifier[];
  // The job's Planning Portal reference, offered as the case number when
  // reporting an inspection.
  portalCaseRef?: string;
  // The signed-in certifier's email — shown in the Portal panel as the
  // submitting user, because the Portal requires it on every call.
  submitterEmail?: string;
}) {
  // Sorted here rather than in the query: a database where migration 0022
  // has not been run has no sort_order column at all, and ordering by a
  // column that doesn't exist fails the whole request and empties the tab.
  const ordered = [...inspections].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="space-y-4">
      <InspectionOrderProvider
        jobId={jobId}
        rows={ordered.map((insp) => ({
          id: insp.id,
          node: <InspectionRow insp={insp} jobId={jobId} firmId={firmId} certifiers={certifiers} portalCaseRef={portalCaseRef} submitterEmail={submitterEmail} />,
        }))}
      />
      <AddInspectionForm jobId={jobId} />
    </div>
  );
}

async function InspectionRow({ insp, jobId, firmId, certifiers, portalCaseRef, submitterEmail }: { insp: InspectionWithDefects; jobId: string; firmId: string; certifiers: Certifier[]; portalCaseRef: string; submitterEmail: string }) {
  const reportUrl = await signedUrl(insp.report_file_path);
  const photos = insp.inspection_photos || [];
  const photoUrls = await Promise.all(photos.map((p) => signedUrl(p.file_path)));

  return (
    <InspectionSigning jobId={jobId} inspectionId={insp.id} signedAt={insp.report_signed_at}>
      <InspectionCardState inspectionId={insp.id} jobId={jobId} outcome={insp.outcome} date={insp.date || ""} portalReported={!!insp.portal_reported}>
        <InspectionCardShell>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-heading">{insp.title}</div>
              <div className="text-sm text-muted mt-0.5">{insp.description}</div>
              {insp.booked_by_client && !insp.confirmed && (
                <div className="text-xs text-warning-text font-medium mt-1">Booked by client for {formatISODate(insp.date)} — needs confirmation</div>
              )}
            </div>
            <div className="flex items-start gap-2 shrink-0">
              <OutcomeBadge />
              <InspectionMoveButtons inspectionId={insp.id} />
            </div>
          </div>

          <div className="mt-3 grid sm:grid-cols-3 gap-2 items-end">
            <InspectionDateBox />

            <div>
              <label className="block text-[11px] text-muted mb-1">Inspector</label>
              <AutoSubmitSelect
                action={assignInspector}
                hidden={{ inspection_id: insp.id, job_id: jobId }}
                name="certifier_id"
                defaultValue={insp.inspector_certifier_id || ""}
                className="w-full px-2 py-1.5 rounded border border-line text-xs"
              >
                <option value="">— Select —</option>
                {certifiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </AutoSubmitSelect>
            </div>

            <div>
              <label className="block text-[11px] text-muted mb-1">Outcome</label>
              <OutcomeSelect />
            </div>
          </div>

          {insp.booked_by_client && !insp.confirmed && (
            <form action={confirmBooking} className="mt-2">
              <input type="hidden" name="inspection_id" value={insp.id} />
              <input type="hidden" name="job_id" value={jobId} />
              <button className="text-xs font-semibold text-success hover:underline">Confirm client&apos;s booking</button>
            </form>
          )}

          <IssuesWhenNeeded inspectionId={insp.id} jobId={jobId} defects={insp.defects} />

          <div className="mt-3">
            <div className="text-[11px] font-semibold text-muted mb-1.5">Photos</div>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                {photos.map((p, idx) => (
                  <div key={p.id} className="space-y-1">
                    {photoUrls[idx] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrls[idx]!} alt={p.caption || "Inspection photo"} className="w-full aspect-[4/3] object-cover rounded-md border border-line" />
                    )}
                    <form action={setPhotoCaption} className="flex gap-1">
                      <input type="hidden" name="photo_id" value={p.id} />
                      <input type="hidden" name="job_id" value={jobId} />
                      <input name="caption" defaultValue={p.caption || ""} placeholder="Caption" className="flex-1 min-w-0 px-1.5 py-1 rounded border border-line text-[11px]" />
                      <button className="text-[11px] text-secondary hover:underline shrink-0">Save</button>
                    </form>
                    <form action={removePhoto}>
                      <input type="hidden" name="photo_id" value={p.id} />
                      <input type="hidden" name="job_id" value={jobId} />
                      <button className="text-[11px] text-error hover:underline">Remove</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            <InspectionPhotoUpload inspectionId={insp.id} jobId={jobId} pathPrefix={`${firmId}/${jobId}/inspections/${insp.id}/photos`} existing={photos.length} />
          </div>

          {/* The report's two prose sections, editable here rather than only via
              the Word round-trip. Collapsed by default since most reports use
              the standard wording untouched. */}
          <details className="mt-3">
            <summary className="text-xs text-muted cursor-pointer hover:text-heading">Report wording (opening paragraph, notes)</summary>
            <form action={updateInspectionReportText} className="mt-2 space-y-2">
              <input type="hidden" name="inspection_id" value={insp.id} />
              <input type="hidden" name="job_id" value={jobId} />
              <div>
                <label className="text-[11px] text-muted">Opening paragraph — leave blank for the standard wording</label>
                <textarea
                  name="report_intro_override"
                  defaultValue={insp.report_intro_override || ""}
                  rows={3}
                  placeholder="We have attended the above property and completed an inspection. The areas inspected and the overall outcome of the inspection are listed below, together with any specific defects noted or documents required."
                  className="w-full px-2 py-1.5 rounded border border-line text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted">Notes — an extra section on the report; left out entirely when blank</label>
                <textarea name="report_notes" defaultValue={insp.report_notes || ""} rows={3} className="w-full px-2 py-1.5 rounded border border-line text-xs" />
              </div>
              <button className="text-xs text-secondary hover:underline">Save report wording</button>
            </form>
          </details>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            {/* Reviewing and signing are separate, deliberate steps, matching the
                certificate version card. The single "Generate / Sign Inspection
                Report" button this replaces only ever opened the report page —
                it never generated or signed anything — but read as though
                pressing it would do both. */}
            <Link href={`/jobs/${jobId}/inspections/${insp.id}/report`} className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
              <FileText size={12} /> Review report
            </Link>
            <a href={`/api/jobs/${jobId}/inspections/${insp.id}/report/word`} className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
              <Download size={12} /> Export to Word
            </a>
            <DownloadButton
              href={`/api/jobs/${jobId}/inspections/${insp.id}/report/pdf`}
              fallbackName="Inspection Report.pdf"
              className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
            >
              <FileDown size={12} /> Download inspection report
            </DownloadButton>
            <SignInspectionReportButton />
            {reportUrl && (
              <a href={reportUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">
                View uploaded report
              </a>
            )}
            <ActionUpload
              action={uploadInspectionReport}
              fields={{ inspection_id: insp.id, job_id: jobId }}
              pathPrefix={`${firmId}/${jobId}/inspections/${insp.id}`}
              label={insp.report_sent ? "Replace uploaded report" : "Upload report file"}
            />
            {insp.report_sent && (
              <>
                <span className="text-[11px] text-success">Available {formatISODate(insp.report_sent_date)}</span>
                <NotifyClientButton
                  action={notifyClientMessage}
                  label="Notify client"
                  fields={{
                    job_id: jobId,
                    subject: "Inspection report available",
                    message: `The report for your ${insp.title} inspection is now available in your portal.`,
                  }}
                />
              </>
            )}
            <ReportToPortalButton
              inspectionId={insp.id}
              jobId={jobId}
              live={portalConfigured()}
              defaultCaseId={portalCaseRef}
              reported={insp.portal_reported}
              reportedDate={insp.portal_reported_date}
              sentByApi={!!insp.portal_child_case_id}
              summary={{
                title: insp.title,
                date: formatISODate(insp.date),
                outcome: INSPECTION_OUTCOME_TEXT[insp.outcome] || insp.outcome,
                signed: !!insp.report_signed_at,
                submittedBy: certifiers.find((c) => c.id === insp.inspector_certifier_id)?.portal_email || submitterEmail,
              }}
            />
            <RemoveInspectionButton inspectionId={insp.id} jobId={jobId} portalReported={insp.portal_reported} />
            </div>
        </InspectionCardShell>
      </InspectionCardState>
    </InspectionSigning>
  );
}
