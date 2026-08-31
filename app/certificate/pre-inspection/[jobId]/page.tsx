import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { PreInspectionReportBody } from "@/components/certifier/PreInspectionReportBody";
import { getPreInspectionData } from "@/lib/certificates/preInspectionData";

// The pre-inspection report on its own. The same report also appears as a
// page inside the approval, under the certificate it was carried out for.
export default async function PreInspectionReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ mod?: string }>;
}) {
  const { jobId } = await params;
  // ?mod= makes this the modification's own report — its dates, and the
  // modified certificate's number.
  const { mod } = await searchParams;
  const { profile } = await requireProfile("certifier");

  const data = await getPreInspectionData(jobId, profile, undefined, mod || null);
  if (!data) notFound();

  return (
    <CertificatePackage
      backHref={`/jobs/${jobId}?tab=pathway`}
      wordExportHref={`/api/certificate/pre-inspection/${jobId}/word${mod ? `?mod=${mod}` : ""}`}
      allowPrint={false}
    >
      <div className="cert-doc max-w-3xl mx-auto px-4 pb-10 print:px-0 print:pb-0 print:max-w-none">
        <div className="cert-page bg-white p-8 mb-6 shadow-sm print:shadow-none print:mb-0 print:py-[12mm] print:px-[14mm]">
          <PreInspectionReportBody data={data} />
        </div>
      </div>
    </CertificatePackage>
  );
}
