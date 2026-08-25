import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatISODate } from "@/lib/business";
import { signInspectionReport, unsignInspectionReport } from "@/lib/actions/inspections";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { DocumentHeader } from "@/components/certifier/DocumentHeader";
import { getInspectionReportData } from "@/lib/certificates/inspectionReportData";
import { formatAddress } from "@/lib/certificates/pathwayData";

// Set the way the certificate and the pre-inspection report are — navy
// ruled headings, right-aligned labels against their values, the same
// sizes throughout — so a pack of documents from one job reads as one set
// rather than three documents that happen to share a letterhead.

// Skips the row entirely rather than showing an empty "—" line: this
// report reads as a record of what is actually on file, unlike the
// certificates, which always show every field because a certificate is a
// fixed legal form.
function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <tr className="align-top">
      <td className="py-1 pr-3 text-sm font-semibold text-heading text-right align-top w-[38%]">{label}</td>
      <td className="py-1 text-sm text-heading">{value}</td>
    </tr>
  );
}

// Same as Row, but the value can be several references on their own lines
// (e.g. multiple DA numbers) instead of a single string.
function RowMultiline({ label, lines }: { label: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <tr className="align-top">
      <td className="py-1 pr-3 text-sm font-semibold text-heading text-right align-top w-[38%]">{label}</td>
      <td className="py-1 text-sm text-heading">
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </td>
    </tr>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-bold uppercase text-doc-heading border-b border-line pb-1 pt-4 mb-2">{children}</div>;
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

// The folder is [id] rather than [jobId] to match
// app/(certifier)/jobs/[id]. Next.js requires one name per dynamic
// segment across the whole route tree, and having both meant every
// request — not just these — failed with "You cannot use different slug
// names for the same dynamic path".
export default async function InspectionReportPage({ params }: { params: Promise<{ id: string; inspectionId: string }> }) {
  const { id: jobId, inspectionId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getInspectionReportData(jobId, inspectionId, profile.firm_id);
  if (!data) notFound();
  const { job, firm: firmData, inspection, inspector, signatureUrl, logoUrl, photoUrls, d, applicantName, certRef, certNumbers, consentRefLines, introText, notes } = data;

  // The results table is built from an array so a future report covering
  // several inspection areas in one visit just means feeding in more rows —
  // today that's always this one inspection.
  const resultsRows = [inspection];

  // A signed report with no signature on it used to be a blank gap, which
  // reads as the app being broken rather than as the one thing it is: no
  // signature has been uploaded for whoever is set as the inspector.
  const signedWithoutSignature = !!inspection.report_signed_at && !signatureUrl;

  return (
    <CertificatePackage
      backHref={`/jobs/${jobId}?tab=inspections`}
      wordExportHref={`/api/jobs/${jobId}/inspections/${inspectionId}/report/word`}
      pdfHref={`/api/jobs/${jobId}/inspections/${inspectionId}/report/pdf`}
      allowPrint={false}
      signed={!!inspection.report_signed_at}
      signedLabel={`Signed ${formatISODate(inspection.report_signed_at)}`}
      signAction={signInspectionReport}
      unsignAction={unsignInspectionReport}
      signFields={{ job_id: jobId, inspection_id: inspectionId }}
    >
      <div className="cert-doc max-w-3xl mx-auto px-4 pb-10 print:px-0 print:pb-0 print:max-w-none">
        <div className="cert-page bg-white p-8 mb-6 shadow-sm print:shadow-none print:mb-0 print:py-[12mm] print:px-[14mm]">
          <DocumentHeader firm={firmData} logoUrl={logoUrl} />

          <div className="border-b border-line pb-1.5 mb-3">
            <div className="text-base font-bold uppercase text-doc-heading">
              INSPECTION REPORT – {certRef} – {inspection.title}
            </div>
            <div className="text-xs text-muted mt-0.5">{job.address}</div>
          </div>

          <Heading>APPLICANT DETAILS</Heading>
          <table className="w-full">
            <tbody>
              <Row label="Applicant:" value={applicantName} />
              <Row label="Address:" value={formatAddress(d.applicantAddress)} />
              <Row label="Phone:" value={d.contact?.phone || d.contact?.mobile} />
              <Row label="Email:" value={d.contact?.email} />
            </tbody>
          </table>

          <Heading>RELEVANT CONSENTS</Heading>
          <table className="w-full">
            <tbody>
              <Row label="Local Government Area:" value={d.council?.lga} />
              <RowMultiline label="Development Applications (if applicable):" lines={consentRefLines} />
              <Row label={`${job.pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate"} Number`} value={certNumbers} />
            </tbody>
          </table>

          <Heading>PROPOSAL</Heading>
          <table className="w-full">
            <tbody>
              <Row label="Address of Development:" value={job.address} />
              <Row label="Lot / DP:" value={d.certificateDetails?.lotSectionDp} />
              <Row label="Land Use Zoning:" value={d.zoning} />
              <Row label="Scope of Building Works Covered by this Notice:" value={job.description} />
            </tbody>
          </table>

          <Heading>INSPECTION DETAILS</Heading>
          <table className="w-full">
            <tbody>
              <Row label="Inspector:" value={inspector?.name} />
              <Row label="Inspection date:" value={inspection.date ? formatISODate(inspection.date) : null} />
              <Row label="Registration No.:" value={inspector?.registration_no} />
            </tbody>
          </table>

          <Heading>INSPECTION RESULTS</Heading>
          <p className="text-sm mb-3 whitespace-pre-line">{introText}</p>
          <table className="w-full border border-line text-sm break-inside-avoid">
            <thead>
              <tr className="bg-surface">
                <th className="text-left font-semibold px-3 py-1.5 border border-line">Inspection Area</th>
                <th className="text-left font-semibold px-3 py-1.5 border border-line">Inspection Outcome</th>
                <th className="text-left font-semibold px-3 py-1.5 border border-line w-40">Reinspections</th>
              </tr>
            </thead>
            <tbody>
              {resultsRows.map((r, i) => (
                <tr key={r.id}>
                  <td className="px-3 py-1.5 border border-line">
                    {i + 1}. {r.title}
                  </td>
                  <td className="px-3 py-1.5 border border-line">{OUTCOME_TEXT[r.outcome] || "Pending"}</td>
                  <td className="px-3 py-1.5 border border-line">{REINSPECTION_TEXT[r.outcome] || "No re-inspections required for this inspection."}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Heading>REQUIRED DOCUMENTS</Heading>
          {inspection.defects.length === 0 ? (
            <p className="text-sm text-muted">No further documents are required.</p>
          ) : (
            <ol className="list-decimal pl-5 text-sm space-y-0.5">
              {inspection.defects.map((d2) => (
                  <li key={d2.id}>{d2.text}</li>
              ))}
            </ol>
          )}

          {notes && (
            <>
              <Heading>NOTES</Heading>
              <p className="text-sm whitespace-pre-line">{notes}</p>
            </>
          )}

          <div className="break-inside-avoid">
            <Heading>SIGNED BY:</Heading>
            {signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signatureUrl} alt={`${inspector?.name} signature`} className="h-20 print:h-11 mb-1" />
            ) : (
              <div className="h-20 print:h-11" />
            )}
            <div className="text-sm">{inspector?.name || "—"} &ndash; Inspector</div>
            {signedWithoutSignature && (
              // print:hidden — it is a note to the certifier about their own
              // setup, not part of the report anyone else should receive.
              <div className="text-xs text-error mt-2 print:hidden">
                This report is signed, but no signature image has been uploaded for {inspector?.name || "this inspector"}. Add one under Settings →
                Certifiers and it will appear here and in the Word export.
              </div>
            )}
          </div>

          <table className="doc-footer w-full text-[11px] text-placeholder border-t border-line mt-6 pt-2">
            <tbody>
              <tr>
                <td>Project No.: {certRef}</td>
                <td className="text-right">{firmData?.website}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {inspection.inspection_photos.length > 0 && (
          <div className="cert-page bg-white p-8 mb-6 shadow-sm print:shadow-none print:mb-0 print:py-[12mm] print:px-[14mm] print:break-before-page" data-page-break="before">
            <DocumentHeader firm={firmData} logoUrl={logoUrl} />
            <div className="border-b border-line pb-1.5 mb-3">
              <div className="text-base font-bold uppercase text-doc-heading">PHOTOGRAPHIC EVIDENCE</div>
              <div className="text-xs text-muted mt-0.5">
                {inspection.title} – {certRef}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {inspection.inspection_photos.map((p, i) => (
                <div key={p.id} className="break-inside-avoid">
                  {photoUrls[i] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrls[i]!} alt={p.caption || "Inspection photo"} className="w-full aspect-[4/3] object-cover rounded-md border border-line" />
                  )}
                  <div className="text-xs text-muted mt-1">
                    {i + 1}. {p.caption || ""}
                  </div>
                </div>
              ))}
            </div>
            <table className="doc-footer w-full text-[11px] text-placeholder border-t border-line mt-6 pt-2">
              <tbody>
                <tr>
                  <td>Project No.: {certRef}</td>
                  <td className="text-right">{firmData?.website}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CertificatePackage>
  );
}
