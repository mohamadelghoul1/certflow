import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatISODate } from "@/lib/business";
import { signInspectionReport } from "@/lib/actions/inspections";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { DocumentHeader } from "@/components/certifier/DocumentHeader";
import { getInspectionReportData } from "@/lib/certificates/inspectionReportData";
import { formatAddress } from "@/lib/certificates/pathwayData";

// Skips the row entirely rather than showing an empty "—" line, per the
// existing report format's convention of not leaving blank fields visible.
function CertRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <tr className="align-top">
      <td className="py-1.5 pr-4 text-sm font-semibold text-slate-800 whitespace-nowrap w-1/3">{label}</td>
      <td className="py-1.5 text-sm text-slate-700">{value}</td>
    </tr>
  );
}

// Same as CertRow, but the value can be several references on their own
// lines (e.g. multiple DA numbers) instead of a single string.
function CertRowMultiline({ label, lines }: { label: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <tr className="align-top">
      <td className="py-1.5 pr-4 text-sm font-semibold text-slate-800 whitespace-nowrap w-1/3">{label}</td>
      <td className="py-1.5 text-sm text-slate-700">
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </td>
    </tr>
  );
}

const OUTCOME_TEXT: Record<string, string> = {
  passed: "Satisfactory — no issues identified",
  passed_subject_to: "Satisfactory (minor issues) subject to documents/conditions being provided",
  failed: "Unsatisfactory — see required documents below",
  pending: "Pending",
};
const REINSPECTION_TEXT: Record<string, string> = {
  failed: "Re-inspection required",
  passed_subject_to: "No re-inspection required, subject to documents/conditions being provided",
};

export default async function InspectionReportPage({ params }: { params: Promise<{ jobId: string; inspectionId: string }> }) {
  const { jobId, inspectionId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getInspectionReportData(jobId, inspectionId, profile.firm_id);
  if (!data) notFound();
  const { job, firm: firmData, inspection, inspector, signatureUrl, logoUrl, photoUrls, d, applicantName, certRef, certNumbers, consentRefLines } = data;

  // The results table is built from an array so a future report covering
  // several inspection areas in one visit just means feeding in more rows —
  // today that's always this one inspection.
  const resultsRows = [inspection];

  return (
    <CertificatePackage
      backHref={`/jobs/${jobId}?tab=inspections`}
      wordExportHref={`/api/jobs/${jobId}/inspections/${inspectionId}/report/word`}
      signed={!!inspection.report_signed_at}
      signedLabel={`Signed ${formatISODate(inspection.report_signed_at)}`}
      signAction={signInspectionReport}
      signFields={{ job_id: jobId, inspection_id: inspectionId }}
    >
      <div className="max-w-2xl mx-auto p-8 bg-white text-slate-900 print:max-w-none">
        <DocumentHeader firm={firmData} logoUrl={logoUrl} />

        <h1 className="text-lg font-bold">
          INSPECTION REPORT – {certRef} – {inspection.title}
        </h1>
        <div className="text-sm text-slate-500 mb-6">{job.address}</div>

        <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">APPLICANT DETAILS</div>
        <table className="w-full mb-4">
          <tbody>
            <CertRow label="Applicant:" value={applicantName} />
            <CertRow label="Address:" value={formatAddress(d.applicantAddress)} />
            <CertRow label="Phone:" value={d.contact?.phone || d.contact?.mobile} />
            <CertRow label="Email:" value={d.contact?.email} />
          </tbody>
        </table>

        <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">RELEVANT CONSENTS</div>
        <table className="w-full mb-4">
          <tbody>
            <CertRow label="Local Government Area:" value={d.council?.lga} />
            <CertRowMultiline label="Development Applications (if applicable):" lines={consentRefLines} />
            <CertRow
              label={`${job.pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate"} Number`}
              value={certNumbers}
            />
          </tbody>
        </table>

        <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">PROPOSAL</div>
        <table className="w-full mb-4">
          <tbody>
            <CertRow label="Address of Development:" value={job.address} />
            <CertRow label="Lot / DP:" value={d.certificateDetails?.lotSectionDp} />
            <CertRow label="Land Use Zoning:" value={d.zoning} />
            <CertRow label="Scope of Building Works Covered by this Notice:" value={job.description} />
          </tbody>
        </table>

        <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">INSPECTION DETAILS</div>
        <table className="w-full mb-4">
          <tbody>
            <CertRow label="Inspector:" value={inspector?.name} />
            <CertRow label="Inspection date:" value={formatISODate(inspection.date)} />
            <CertRow label="Registration No.:" value={inspector?.registration_no} />
          </tbody>
        </table>

        <div className="text-sm font-bold mb-1">INSPECTION RESULTS</div>
        <div className="text-xs text-slate-500 mb-2">
          We have attended the above property and completed an inspection. The areas inspected and the overall outcome of the inspection are listed below,
          together with any specific defects noted or documents required.
        </div>
        <table className="w-full mb-4 border border-slate-300 text-sm break-inside-avoid">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-left font-semibold px-3 py-1.5 border border-slate-300">Inspection Area</th>
              <th className="text-left font-semibold px-3 py-1.5 border border-slate-300">Inspection Outcome</th>
              <th className="text-left font-semibold px-3 py-1.5 border border-slate-300 w-40">Reinspections</th>
            </tr>
          </thead>
          <tbody>
            {resultsRows.map((r, i) => (
              <tr key={r.id}>
                <td className="px-3 py-1.5 border border-slate-300">
                  {i + 1}. {r.title}
                </td>
                <td className="px-3 py-1.5 border border-slate-300">{OUTCOME_TEXT[r.outcome] || "Pending"}</td>
                <td className="px-3 py-1.5 border border-slate-300">{REINSPECTION_TEXT[r.outcome] || "No re-inspections required for this inspection."}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-sm font-bold mb-1">REQUIRED DOCUMENTS</div>
        {inspection.defects.length === 0 ? (
          <div className="text-sm text-slate-400 italic mb-4">No further documents are required.</div>
        ) : (
          <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-0.5 mb-4">
            {inspection.defects.map((d2) => (
              <li key={d2.id}>
                {d2.text} — {d2.resolved ? <span className="text-emerald-600 font-medium">Resolved</span> : <span className="text-amber-700 font-medium">Required</span>}
              </li>
            ))}
          </ol>
        )}

        <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2 mt-6 break-inside-avoid">SIGNED BY:</div>
        <div className="break-inside-avoid">
          {/* No ruled line under the signature — see SignatureLine in the
              certificate pages for why. Unsigned, this is just the blank
              gap the signature will fill. */}
          {signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signatureUrl} alt={`${inspector?.name} signature`} className="h-20 mb-1" />
          ) : (
            <div className="h-20" />
          )}
          <div className="text-sm">{inspector?.name || "—"} – Inspector</div>
          <div className="text-sm text-slate-500">{formatISODate(inspection.date)}</div>
        </div>

        <table className="w-full text-[11px] text-slate-400 border-t border-slate-200 mt-8 pt-2">
          <tbody>
            <tr>
              <td>Project No.: {certRef}</td>
              <td className="text-right">{firmData?.website}</td>
            </tr>
          </tbody>
        </table>

        {inspection.inspection_photos.length > 0 && (
          <div className="pt-8 print:break-before-page" data-page-break="before">
            <DocumentHeader firm={firmData} logoUrl={logoUrl} />
            <h2 className="text-lg font-bold mb-1">PHOTOGRAPHIC EVIDENCE</h2>
            <div className="text-sm text-slate-500 mb-4">
              {inspection.title} – {certRef}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {inspection.inspection_photos.map((p, i) => (
                <div key={p.id} className="break-inside-avoid">
                  {photoUrls[i] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrls[i]!} alt={p.caption || "Inspection photo"} className="w-full aspect-[4/3] object-cover rounded-md border border-slate-300" />
                  )}
                  <div className="text-xs text-slate-600 mt-1">
                    {i + 1}. {p.caption || ""}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-200 mt-8 pt-2">
              <span>Project No.: {certRef}</span>
              <span>{firmData?.website}</span>
            </div>
          </div>
        )}
      </div>
    </CertificatePackage>
  );
}
