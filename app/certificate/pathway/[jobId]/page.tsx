import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatISODate } from "@/lib/business";
import { signPathwayCertificate, uploadPathwayApproval } from "@/lib/actions/jobs";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { getPathwayCertificateData } from "@/lib/certificates/pathwayData";
import { getPreInspectionData } from "@/lib/certificates/preInspectionData";
import { PathwayCertificateDocument } from "@/components/certifier/PathwayCertificateDocument";

export default async function PathwayCertificatePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getPathwayCertificateData(jobId, profile.firm_id);
  if (!data) notFound();

  // Shown as a page of the approval only once both dates are recorded,
  // which is the same test the downloaded set applies — so what is
  // reviewed here is what is handed over.
  const preInspection = await getPreInspectionData(jobId, profile);
  const withReport = preInspection?.applicationDate && preInspection?.inspectionDate ? preInspection : null;

  // Only what framing the document needs — the document itself takes the
  // whole data object.
  const { job, activeVersionId, uploadedApprovalUrl } = data;

  return (
    <CertificatePackage
      backHref={`/jobs/${jobId}?tab=pathway`}
      wordExportHref={`/api/certificate/pathway/${jobId}/word`}
      allowPrint={false}
      signed={!!job.pathway_signed_at}
      signedLabel={`Signed ${formatISODate(job.pathway_signed_at)}`}
      signAction={signPathwayCertificate}
      signFields={{ job_id: jobId }}
      uploadAction={activeVersionId ? uploadPathwayApproval : undefined}
      uploadFields={activeVersionId ? { job_id: jobId, version_id: activeVersionId } : undefined}
      uploadPathPrefix={`${profile.firm_id}/${jobId}/certificates/pathway/${activeVersionId || "current"}`}
      uploadedUrl={uploadedApprovalUrl}
    >
      <PathwayCertificateDocument data={data} preInspection={withReport} />
    </CertificatePackage>
  );
}
