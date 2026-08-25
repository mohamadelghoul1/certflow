import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { PreInspectionReportBody } from "@/components/certifier/PreInspectionReportBody";
import { getPreInspectionData } from "@/lib/certificates/preInspectionData";

// The pre-inspection report on its own. The same report also appears as a
// page inside the approval, under the certificate it was carried out for.
export default async function PreInspectionReportPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getPreInspectionData(jobId, profile);
  if (!data) notFound();

  return (
    <CertificatePackage backHref={`/jobs/${jobId}?tab=pathway`} wordExportHref={`/api/certificate/pre-inspection/${jobId}/word`} allowPrint={false}>
      <div className="cert-doc max-w-3xl mx-auto px-4 pb-10 print:px-0 print:pb-0 print:max-w-none">
        <div className="cert-page bg-white p-8 mb-6 shadow-sm print:shadow-none print:mb-0 print:py-[12mm] print:px-[14mm]">
          <PreInspectionReportBody data={data} />
        </div>
      </div>
    </CertificatePackage>
  );
}
