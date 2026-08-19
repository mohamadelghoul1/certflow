import Link from "next/link";
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
  addPhoto,
  setPhotoCaption,
  removePhoto,
  reportToPortal,
} from "@/lib/actions/inspections";
import { notifyClientMessage } from "@/lib/actions/jobs";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { AutoSubmitSelect } from "@/components/certifier/AutoSubmitSelect";
import type { Inspection, Defect, InspectionPhoto, Certifier } from "@/types/db";

type InspectionWithDefects = Inspection & { defects: Defect[]; inspection_photos: InspectionPhoto[] };

const OUTCOME_META: Record<string, { label: string; style: string }> = {
  pending: { label: "Pending", style: "bg-slate-100 text-slate-600" },
  passed: { label: "Passed", style: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", style: "bg-red-50 text-red-700" },
  passed_subject_to: { label: "Passed subject to", style: "bg-amber-50 text-amber-700" },
};

export async function InspectionsPanel({
  jobId,
  firmId,
  pathwayGenerated,
  inspections,
  certifiers,
}: {
  jobId: string;
  firmId: string;
  pathwayGenerated: boolean;
  inspections: InspectionWithDefects[];
  certifiers: Certifier[];
}) {
  if (!pathwayGenerated) {
    return <div className="text-sm text-slate-400">Inspections open once the original {"CDC/CC"} is issued.</div>;
  }

  return (
    <div className="space-y-3">
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
    <div className="border border-slate-200 rounded-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-teal-900">{insp.title}</div>
          <div className="text-xs text-slate-500">{insp.description}</div>
          {insp.booked_by_client && !insp.confirmed && (
            <div className="text-xs text-amber-700 font-medium mt-1">Booked by client for {formatISODate(insp.date)} — needs confirmation</div>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${meta.style}`}>{meta.label}</span>
      </div>

      <div className="mt-3 grid sm:grid-cols-3 gap-2 items-end">
        <form action={setInspectionDate} className="flex items-end gap-2">
          <input type="hidden" name="inspection_id" value={insp.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <div className="flex-1">
            <label className="block text-[11px] text-slate-400 mb-1">Date</label>
            <input type="date" name="date" defaultValue={insp.date || ""} className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" />
            {dateOnWeekend && <div className="text-[11px] text-amber-700 mt-1">⚠ falls on a weekend</div>}
          </div>
          <button className="text-xs text-teal-800 hover:underline pb-1.5">Save</button>
        </form>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Inspector</label>
          <AutoSubmitSelect
            action={assignInspector}
            hidden={{ inspection_id: insp.id, job_id: jobId }}
            name="certifier_id"
            defaultValue={insp.inspector_certifier_id || ""}
            className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs"
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
          <label className="block text-[11px] text-slate-400 mb-1">Outcome</label>
          <AutoSubmitSelect
            action={recordOutcome}
            hidden={{ inspection_id: insp.id, job_id: jobId }}
            name="outcome"
            defaultValue={insp.outcome}
            className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs"
          >
            <option value="pending">Pending</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="passed_subject_to">Passed subject to</option>
          </AutoSubmitSelect>
        </div>
      </div>

      {insp.booked_by_client && !insp.confirmed && (
        <form action={confirmBooking} className="mt-2">
          <input type="hidden" name="inspection_id" value={insp.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <button className="text-xs font-semibold text-emerald-700 hover:underline">Confirm client&apos;s booking</button>
        </form>
      )}

      {needsDefect && (
        <div className="mt-3 space-y-2">
          {insp.defects.map((d) => (
            <div key={d.id} className={`text-xs rounded-md px-3 py-2 flex items-start justify-between gap-3 ${d.resolved ? "bg-slate-50 text-slate-400 line-through" : "bg-amber-50 text-amber-800"}`}>
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
            <input name="text" placeholder="Add a defect / condition…" className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-xs" />
            <button className="text-xs font-semibold text-amber-700 hover:underline">Add</button>
          </form>
        </div>
      )}

      <div className="mt-3">
        <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Photos</div>
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
            {photos.map((p, idx) => (
              <div key={p.id} className="space-y-1">
                {photoUrls[idx] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrls[idx]!} alt={p.caption || "Inspection photo"} className="w-full aspect-[4/3] object-cover rounded-md border border-slate-200" />
                )}
                <form action={setPhotoCaption} className="flex gap-1">
                  <input type="hidden" name="photo_id" value={p.id} />
                  <input type="hidden" name="job_id" value={jobId} />
                  <input name="caption" defaultValue={p.caption || ""} placeholder="Caption" className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-200 text-[11px]" />
                  <button className="text-[11px] text-teal-800 hover:underline shrink-0">Save</button>
                </form>
                <form action={removePhoto}>
                  <input type="hidden" name="photo_id" value={p.id} />
                  <input type="hidden" name="job_id" value={jobId} />
                  <button className="text-[11px] text-red-500 hover:underline">Remove</button>
                </form>
              </div>
            ))}
          </div>
        )}
        <ActionUpload action={addPhoto} fields={{ inspection_id: insp.id, job_id: jobId }} pathPrefix={`${firmId}/${jobId}/inspections/${insp.id}/photos`} label="Add photo" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Link href={`/jobs/${jobId}/inspections/${insp.id}/report`} className="text-xs font-semibold text-teal-800 hover:underline">
          Generate inspection report
        </Link>
        {reportUrl && (
          <a href={reportUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-800 hover:underline">
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
            <span className="text-[11px] text-emerald-700">Available {formatISODate(insp.report_sent_date)}</span>
            <form action={notifyClientMessage}>
              <input type="hidden" name="job_id" value={jobId} />
              <input type="hidden" name="subject" value="Inspection report available" />
              <input type="hidden" name="message" value={`The report for your ${insp.title} inspection is now available in your portal.`} />
              <button className="text-xs font-semibold text-teal-800 hover:underline">Notify client</button>
            </form>
          </>
        )}
        <form action={reportToPortal}>
          <input type="hidden" name="inspection_id" value={insp.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <button disabled={insp.portal_reported} className="text-xs font-semibold text-slate-600 hover:underline disabled:opacity-50 disabled:cursor-default">
            {insp.portal_reported ? `Reported to Portal ${formatISODate(insp.portal_reported_date)}` : "Report to NSW Planning Portal"}
          </button>
        </form>
        <form action={removeInspection} className="ml-auto">
          <input type="hidden" name="inspection_id" value={insp.id} />
          <input type="hidden" name="job_id" value={jobId} />
          <button className="text-xs text-red-500 hover:underline">Remove</button>
        </form>
      </div>
    </div>
  );
}
