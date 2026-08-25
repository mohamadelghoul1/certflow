import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { DocumentHeader } from "@/components/certifier/DocumentHeader";
import { getPreInspectionData } from "@/lib/certificates/preInspectionData";

// The pre-inspection report, laid out the way the certificate is — same
// navy ruled headings, same right-aligned fields — so the pack a
// certifier hands over reads as one set of documents.
export default async function PreInspectionReportPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getPreInspectionData(jobId, profile);
  if (!data) notFound();

  const { firm, logoUrl, signatureUrl } = data;

  return (
    <CertificatePackage backHref={`/jobs/${jobId}?tab=pathway`} wordExportHref={`/api/certificate/pre-inspection/${jobId}/word`} allowPrint={false}>
      <div className="cert-doc max-w-3xl mx-auto px-4 pb-10 print:px-0 print:pb-0 print:max-w-none">
        <div className="cert-page bg-white p-8 mb-6 shadow-sm print:shadow-none print:mb-0 print:py-[12mm] print:px-[14mm]">
          <DocumentHeader firm={firm} logoUrl={logoUrl} />

          <div className="border-b border-line pb-1.5 mb-3">
            <div className="text-base font-bold uppercase text-doc-heading">{data.title}</div>
            <div className="text-xs text-muted mt-0.5">{data.address}</div>
          </div>

          <table className="w-full">
            <tbody>
              <Heading>APPLICANT DETAILS</Heading>
              <Row label="Applicant:" value={data.applicantName} />
              <Row label="Address:" value={data.applicantAddress} />
              <Row label="Phone:" value={data.applicantPhone} />

              <Heading>{data.isCdc ? "COMPLYING DEVELOPMENT CONSENTS" : "RELEVANT CONSENTS"}</Heading>
              <Row label="Local Government Area:" value={data.lga} />
              {/* A CC is issued against a development application; a CDC
                  has no equivalent, so the row is left out entirely
                  rather than printed empty. */}
              {!data.isCdc && <Row label="Development Applications (if applicable)" value={data.developmentConsentNumber} />}
              <Row label={data.certificateLabel} value={data.ref} />
              <Row label="Application Date" value={data.applicationDate} />

              <Heading>PROPOSAL</Heading>
              <Row label="Address of Development:" value={data.address} />
              <Row label="Lot / DP:" value={data.lotSectionDp} />
              <Row label="Land Use Zoning:" value={data.zoning} />
              <Row label="Scope of Building Works Covered by this Notice:" value={data.scopeOfWorks} />

              <Heading>INSPECTION DETAILS</Heading>
              <Row label="Inspector:" value={data.inspectorName} />
              <Row label="Inspection date:" value={data.inspectionDate} />
              <Row label="Registration No.:" value={data.registrationNo} />
            </tbody>
          </table>

          <div className="text-sm font-bold uppercase text-doc-heading border-b border-line pb-1 pt-4 mb-2">INSPECTION RESULTS</div>
          <p className="text-sm mb-3">
            We have attended the above property and completed an inspection. The areas inspected and the overall outcome of the inspection are listed
            below, together with any specific defects noted or documents required.
          </p>
          <table className="w-full border border-line text-sm">
            <thead>
              <tr className="bg-surface">
                <th className="border border-line px-3 py-1.5 text-left">Inspection Area</th>
                <th className="border border-line px-3 py-1.5 text-left w-44">Inspection Outcome</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.area}>
                  <td className="border border-line px-3 py-1.5">{row.area}</td>
                  <td className="border border-line px-3 py-1.5">{row.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-sm font-bold uppercase text-doc-heading border-b border-line pb-1 pt-6 mb-2">SIGNED BY:</div>
          {signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signatureUrl} alt="Signature" className="h-20 print:h-11 mb-1" />
          ) : (
            <div className="h-20 print:h-11" />
          )}
          <div className="text-sm">{data.inspectorName || "—"} &ndash; Inspector</div>

          <table className="doc-footer w-full text-[11px] text-placeholder border-t border-line mt-6 pt-2">
            <tbody>
              <tr>
                <td>Project No.: {data.projRef}</td>
                <td className="text-right">{firm?.website}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </CertificatePackage>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={2} className="pb-1 pt-4 text-sm font-bold uppercase text-doc-heading border-b border-line">
        {children}
      </td>
    </tr>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr className="align-top">
      <td className="py-1 pr-3 text-sm font-semibold text-heading text-right align-top w-[38%]">{label}</td>
      <td className="py-1 text-sm text-heading">{value || "—"}</td>
    </tr>
  );
}
