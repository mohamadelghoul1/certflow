import Link from "next/link";
import { FileText, Download, FileDown, Smartphone } from "lucide-react";
import { InspectionSigning, SignInspectionReportButton } from "@/components/certifier/SignInspectionReportButton";
import { formatISODate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import {
  assignInspector,
  uploadInspectionReport,
  setPhotoCaption,
  removePhoto,
} from "@/lib/actions/inspections";
import { ReportToPortalButton } from "@/components/certifier/ReportToPortalButton";
import { portalConfigured } from "@/lib/portal/config";
import { INSPECTION_OUTCOME_TEXT, INSPECTION_OUTCOME_BADGE } from "@/lib/constants";
import { notifyClientMessage } from "@/lib/actions/jobs";
import { NotifyClientButton } from "@/components/certifier/NotifyClientButton";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { InspectionPhotoUpload } from "@/components/certifier/InspectionPhotoUpload";
import { DownloadButton } from "@/components/certifier/DownloadButton";
import { InspectionOrderProvider, InspectionMoveButtons } from "@/components/certifier/InspectionOrder";
import { InspectionCardState, InspectionCardShell, OutcomeBadge, OutcomeSelect, InspectionDateBox, IssuesWhenNeeded, RemoveInspectionButton } from "@/components/certifier/InspectionCard";
import { AddInspectionForm } from "@/components/certifier/AddInspectionForm";
import { BookingDecision } from "@/components/certifier/BookingDecision";
import { BookInspectionButton } from "@/components/certifier/BookInspectionButton";
import { AutoSubmitSelect } from "@/components/certifier/AutoSubmitSelect";
import type { Inspection, Defect, InspectionPhoto, Certifier } from "@/types/db";
import { SubmitButton } from "@/components/SubmitButton";

type InspectionWithDefects = Inspection & { defects: Defect[]; inspection_photos: InspectionPhoto[] };

export async function InspectionsPanel({
  jobId,
  firmId,
  inspections,
  certifiers,
  portalCaseRef = "",
  submitterEmail = "",
  manage = true,
}: {
  jobId: string;
  firmId: string;
  inspections: InspectionWithDefects[];
  certifiers: Certifier[];
  // Off for an inspector: they record what they found on the
  // inspections they are given. Adding, removing, reordering,
  // reassigning, bookings, client messages and the NSW Planning Portal
  // are the firm's, and the database (migration 0073) refuses an
  // inspector those even when asked directly.
  manage?: boolean;
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

  const carriedOut = ordered.filter((i) => i.outcome !== "pending");

  return (
    // Two columns on a wide screen: the inspections to work through, and
    // beside them what has already been done. Stacks on a phone, where
    // the summary sits under the list rather than squeezing it.
    <div className="lg:flex lg:items-start lg:gap-6">
      <div className="space-y-4 lg:flex-1 lg:min-w-0">
        <InspectionOrderProvider
          jobId={jobId}
          rows={ordered.map((insp) => ({
            id: insp.id,
            node: <InspectionRow insp={insp} jobId={jobId} firmId={firmId} certifiers={certifiers} portalCaseRef={portalCaseRef} submitterEmail={submitterEmail} manage={manage} />,
          }))}
        />
        {manage && <AddInspectionForm jobId={jobId} />}
      </div>
      <CompletedInspections inspections={carriedOut} total={ordered.length} />
    </div>
  );
}

// What has been carried out, at a glance: which stages, on what day, how
// they went, and whether the Portal has been told. The cards below hold
// all of this, but a job with a dozen inspections answers "where are we
// up to?" only by scrolling through every one of them.
function CompletedInspections({ inspections, total }: { inspections: InspectionWithDefects[]; total: number }) {
  return (
    <aside className="mt-6 lg:mt-0 lg:w-72 lg:shrink-0">
      <div className="border border-line rounded-xl bg-white shadow-sm p-4 lg:sticky lg:top-4">
        <div className="text-sm font-semibold text-heading">Carried out</div>
        <div className="text-xs text-muted mt-0.5 mb-3">
          {inspections.length} of {total} {total === 1 ? "inspection" : "inspections"}
        </div>

        {inspections.length === 0 ? (
          <p className="text-xs text-muted">None yet. An inspection appears here once its outcome is recorded.</p>
        ) : (
          <ul className="space-y-2.5">
            {inspections.map((i) => (
              <li key={i.id} className="text-xs">
                <div className="font-semibold text-heading leading-snug">{i.title}</div>
                <div className="text-muted mt-0.5">
                  {i.date ? formatISODate(i.date) : "no date recorded"} · {INSPECTION_OUTCOME_BADGE[i.outcome] || i.outcome}
                </div>
                {/* The Portal must be told within two business days of the
                    inspection, so an outstanding one is worth seeing here
                    rather than only on the card. */}
                <div className={`mt-0.5 ${i.portal_reported ? "text-accent" : "text-warning-text"}`}>
                  {i.portal_reported ? "✓ Reported to the NSW Planning Portal" : "Not yet reported to the NSW Planning Portal"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

async function InspectionRow({ insp, jobId, firmId, certifiers, portalCaseRef, submitterEmail, manage }: { insp: InspectionWithDefects; jobId: string; firmId: string; certifiers: Certifier[]; portalCaseRef: string; submitterEmail: string; manage: boolean }) {
  const reportUrl = await signedUrl(insp.report_file_path);
  const photos = insp.inspection_photos || [];
  const photoUrls = await Promise.all(photos.map((p) => signedUrl(p.file_path)));

  return (
    <InspectionSigning jobId={jobId} inspectionId={insp.id} signedAt={insp.report_signed_at}>
      <InspectionCardState inspectionId={insp.id} jobId={jobId} outcome={insp.outcome} date={insp.date || ""} portalReported={!!insp.portal_reported}>
        <InspectionCardShell>
          {/* min-w-0 on the name and no shrink-0 on the badge: without
              both, a long outcome ran off the side of the card on a phone
              and squeezed the inspection's name into a column one word
              wide. */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold text-heading">{insp.title}</div>
              <div className="text-sm text-muted mt-0.5">{insp.description}</div>
            </div>
            <div className="flex items-start gap-2 min-w-0">
              <OutcomeBadge />
              {manage && (
                <div className="shrink-0">
                  <InspectionMoveButtons inspectionId={insp.id} />
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 grid sm:grid-cols-3 gap-2 items-end">
            <InspectionDateBox />

            <div>
              <label className="block text-[11px] text-muted mb-1">Inspector</label>
              {manage ? (
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
              ) : (
                <div className="px-2 py-1.5 rounded border border-line bg-surface text-xs text-muted">
                  {certifiers.find((c) => c.id === insp.inspector_certifier_id)?.name || "— Not assigned —"}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-muted mb-1">Outcome</label>
              <OutcomeSelect />
            </div>
          </div>

          {!manage ? null : insp.booked_by_client && !insp.confirmed ? (
            <BookingDecision inspectionId={insp.id} jobId={jobId} requestedDate={insp.date} />
          ) : (
            // The certifier booking the day themselves, rather than
            // waiting for the client to ask. Gone once the inspection has
            // been carried out: an outcome is on the record, and a
            // "book this" button beside it invites a visit that already
            // happened to be given a future date.
            insp.outcome === "pending" && (
              <div className="mt-3">
                <BookInspectionButton inspectionId={insp.id} jobId={jobId} bookedDate={insp.date} confirmed={!!insp.confirmed} />
              </div>
            )
          )}

          <IssuesWhenNeeded inspectionId={insp.id} jobId={jobId} defects={insp.defects} title={insp.title} />

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
                      <SubmitButton className="text-[11px] text-secondary hover:underline shrink-0">Save</SubmitButton>
                    </form>
                    <form action={removePhoto}>
                      <input type="hidden" name="photo_id" value={p.id} />
                      <input type="hidden" name="job_id" value={jobId} />
                      <SubmitButton className="text-[11px] text-error hover:underline">Remove</SubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            )}
            <InspectionPhotoUpload inspectionId={insp.id} jobId={jobId} pathPrefix={`${firmId}/${jobId}/inspections/${insp.id}/photos`} existing={photos.length} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            {/* Reviewing and signing are separate, deliberate steps, matching the
                certificate version card. The single "Generate / Sign Inspection
                Report" button this replaces only ever opened the report page —
                it never generated or signed anything — but read as though
                pressing it would do both. */}
            <Link href={`/jobs/${jobId}/inspections/${insp.id}/report`} className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
              <FileText size={12} /> Review report
            </Link>
            {/* The same inspection as one thumb-sized column — the screen
                to open standing on the slab. */}
            <Link href={`/site/${insp.id}`} className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
              <Smartphone size={12} /> Open on site
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
                {manage && (
                <NotifyClientButton
                  action={notifyClientMessage}
                  label="Notify client"
                  fields={{
                    job_id: jobId,
                    subject: "Inspection report available",
                    message: `The report for your ${insp.title} inspection is now available in your portal.`,
                  }}
                />
                )}
              </>
            )}
            {manage && (
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
            )}
            {manage && <RemoveInspectionButton inspectionId={insp.id} jobId={jobId} portalReported={insp.portal_reported} />}
            {!manage && (
              <span className={`text-[11px] ${insp.portal_reported ? "text-accent" : "text-placeholder"}`}>
                {insp.portal_reported ? "✓ Reported to the NSW Planning Portal by the firm" : "Portal reporting is done by the firm"}
              </span>
            )}
            </div>
        </InspectionCardShell>
      </InspectionCardState>
    </InspectionSigning>
  );
}
