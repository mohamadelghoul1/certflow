import Link from "next/link";
import { FileText, Download, Printer } from "lucide-react";
import { SignInspectionReportButton } from "@/components/certifier/SignInspectionReportButton";
import { formatISODate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import {
  assignInspector,
  setInspectionDate,
  recordOutcome,
  addDefect,
  resolveDefect,
  confirmBooking,
  uploadInspectionReport,
  removeInspection,
  updateInspectionReportText,
  addPhoto,
  setPhotoCaption,
  removePhoto,
  reportToPortal,
} from "@/lib/actions/inspections";
import { notifyClientMessage } from "@/lib/actions/jobs";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { AutoSubmitSelect } from "@/components/certifier/AutoSubmitSelect";
import { CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import type { Inspection, Defect, InspectionPhoto, Certifier } from "@/types/db";
import { DateField } from "@/components/DateField";

type InspectionWithDefects = Inspection & { defects: Defect[]; inspection_photos: InspectionPhoto[] };

const OUTCOME_META: Record<string, { label: string; style: string }> = {
  pending: { label: "Pending", style: "bg-surface text-muted" },
  passed: { label: "Passed", style: "bg-success-bg text-accent" },
  failed: { label: "Failed", style: "bg-error-bg text-error" },
  passed_subject_to: { label: "Satisfactory (minor issues) subject to documents being provided", style: "bg-warning-bg text-warning-text" },
};

function OutcomeIcon({ outcome, size }: { outcome: string; size: number }) {
  if (outcome === "passed") return <CheckCircle2 size={size} />;
  if (outcome === "failed") return <XCircle size={size} />;
  if (outcome === "passed_subject_to") return <AlertTriangle size={size} />;
  return <Clock size={size} />;
}

export async function InspectionsPanel({
  jobId,
  firmId,
  inspections,
  certifiers,
}: {
  jobId: string;
  firmId: string;
  inspections: InspectionWithDefects[];
  certifiers: Certifier[];
}) {
  return (
    <div className="space-y-4">
      {inspections.map((insp) => (
        <InspectionRow key={insp.id} insp={insp} jobId={jobId} firmId={firmId} certifiers={certifiers} />
      ))}
    </div>
  );
}

function fallsOnWeekend(isoDate: string) {
  const day = new Date(`${isoDate}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

async function InspectionRow({ insp, jobId, firmId, certifiers }: { insp: InspectionWithDefects; jobId: string; firmId: string; certifiers: Certifier[] }) {
  const meta = OUTCOME_META[insp.outcome];
  const reportUrl = await signedUrl(insp.report_file_path);
  const needsDefect = insp.outcome === "failed" || insp.outcome === "passed_subject_to";
  const dateOnWeekend = !!insp.date && fallsOnWeekend(insp.date);
  const photos = insp.inspection_photos || [];
  const photoUrls = await Promise.all(photos.map((p) => signedUrl(p.file_path)));

  return (
    <div className="card-lift border border-line rounded-xl p-6 shadow-sm bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-heading">{insp.title}</div>
          <div className="text-sm text-muted mt-0.5">{insp.description}</div>
          {insp.booked_by_client && !insp.confirmed && (
            <div className="text-xs text-warning-text font-medium mt-1">Booked by client for {formatISODate(insp.date)} — needs confirmation</div>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${meta.style}`}>
          <OutcomeIcon outcome={insp.outcome} size={12} /> {meta.label}
        </span>
      </div>

      <div className="mt-3 grid sm:grid-cols-3 gap-2 items-end">
        <form action={setInspectionDate} className="flex items-end gap-2">
          <input type="hidden" name="inspection_id" value={insp.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <div className="flex-1">
            <label className="block text-[11px] text-muted mb-1">Date</label>
            <DateField name="date" defaultValue={insp.date || ""} className="w-full px-2 py-1.5 rounded border border-line text-xs" />
            {dateOnWeekend && <div className="text-[11px] text-warning-text mt-1">⚠ falls on a weekend</div>}
          </div>
          <button className="text-xs text-secondary hover:underline pb-1.5">Save</button>
        </form>

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
          <AutoSubmitSelect
            action={recordOutcome}
            hidden={{ inspection_id: insp.id, job_id: jobId }}
            name="outcome"
            defaultValue={insp.outcome}
            className="w-full px-2 py-1.5 rounded border border-line text-xs"
          >
            <option value="pending">Pending</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="passed_subject_to">Satisfactory (minor issues) subject to documents being provided</option>
          </AutoSubmitSelect>
        </div>
      </div>

      {insp.booked_by_client && !insp.confirmed && (
        <form action={confirmBooking} className="mt-2">
          <input type="hidden" name="inspection_id" value={insp.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <button className="text-xs font-semibold text-success hover:underline">Confirm client&apos;s booking</button>
        </form>
      )}

      {needsDefect && (
        <div className="mt-3 space-y-2">
          {insp.defects.map((d) => (
            <div key={d.id} className={`text-xs rounded-md px-3 py-2 flex items-start justify-between gap-3 ${d.resolved ? "bg-surface text-muted line-through" : "bg-warning-bg text-warning-text"}`}>
              <span>{d.text}</span>
              {!d.resolved && (
                <form action={resolveDefect} className="shrink-0">
                  <input type="hidden" name="defect_id" value={d.id} />
                  <input type="hidden" name="job_id" value={jobId} />
                  <button className="font-semibold hover:underline">Resolve</button>
                </form>
              )}
            </div>
          ))}
          <form action={addDefect} className="flex gap-2">
            <input type="hidden" name="inspection_id" value={insp.id} />
            <input type="hidden" name="job_id" value={jobId} />
            <input name="text" placeholder="Add a defect / condition…" className="flex-1 px-2 py-1.5 rounded border border-line text-xs" />
            <button className="text-xs font-semibold text-warning-text hover:underline">Add</button>
          </form>
        </div>
      )}

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
        <ActionUpload action={addPhoto} fields={{ inspection_id: insp.id, job_id: jobId }} pathPrefix={`${firmId}/${jobId}/inspections/${insp.id}/photos`} label="Add photo" />
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
        <Link href={`/jobs/${jobId}/inspections/${insp.id}/report?print=1`} className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
          <Printer size={12} /> Print / Save as PDF
        </Link>
        {insp.report_signed_at ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
            <CheckCircle2 size={12} /> Signed {formatISODate(insp.report_signed_at)}
          </span>
        ) : (
          <SignInspectionReportButton jobId={jobId} inspectionId={insp.id} />
        )}
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
            <form action={notifyClientMessage}>
              <input type="hidden" name="job_id" value={jobId} />
              <input type="hidden" name="subject" value="Inspection report available" />
              <input type="hidden" name="message" value={`The report for your ${insp.title} inspection is now available in your portal.`} />
              <button className="text-xs font-semibold text-secondary hover:underline">Notify client</button>
            </form>
          </>
        )}
        <form action={reportToPortal}>
          <input type="hidden" name="inspection_id" value={insp.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <button disabled={insp.portal_reported} className="text-xs font-semibold text-muted hover:underline disabled:opacity-50 disabled:cursor-default">
            {insp.portal_reported ? `Reported to Portal ${formatISODate(insp.portal_reported_date)}` : "Report to NSW Planning Portal"}
          </button>
        </form>
        <form action={removeInspection} className="ml-auto">
          <input type="hidden" name="inspection_id" value={insp.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <button className="text-xs text-error hover:underline">Remove</button>
        </form>
      </div>
    </div>
  );
}
