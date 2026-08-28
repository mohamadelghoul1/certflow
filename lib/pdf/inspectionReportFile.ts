import { getInspectionReportData } from "@/lib/certificates/inspectionReportData";
import { buildInspectionReportPdf } from "@/lib/pdf/inspectionReport";
import { fetchStampImage } from "@/lib/pdf/stamp";
import { fetchPhotoImage } from "@/lib/images/photo";
import { fetchStoredFile } from "@/lib/storage";
import { jobDocumentName } from "@/lib/downloadName";
import type { SupabaseClient } from "@supabase/supabase-js";

// One inspection report as a PDF, however it has to be obtained.
//
// A signed report was built at the moment it was signed and cannot have
// changed since, so it is served from storage; anything else — a report
// still being written, or one reopened for editing — is drawn here. Both
// the download route and the Occupation Certificate set need exactly
// that, and a set of a dozen inspections rebuilding signed reports it
// already has on disk is the difference between a download and a wait.

export type InspectionReportFile = { bytes: Uint8Array; fileName: string; title: string; date: string | null; signed: boolean };

export async function inspectionReportPdf(jobId: string, inspectionId: string, firmId: string, client?: SupabaseClient): Promise<InspectionReportFile | null> {
  const data = await getInspectionReportData(jobId, inspectionId, firmId, client);
  if (!data) return null;

  const fileName = jobDocumentName(data.certRef, data.job.address || "", `Inspection Report - ${data.inspection.title}`, "pdf");
  const common = { fileName, title: data.inspection.title, date: data.inspection.date, signed: !!data.inspection.report_signed_at };

  if (data.inspection.report_pdf_path) {
    const stored = await fetchStoredFile(data.inspection.report_pdf_path, client);
    if (stored) return { bytes: stored.bytes, ...common };
  }

  // In parallel — a report with a dozen photos fetched one after another
  // is what makes a download like this feel broken.
  const [logo, signature, photoImages] = await Promise.all([
    fetchStampImage(data.logoUrl),
    fetchStampImage(data.signatureUrl),
    Promise.all(data.photoUrls.map((url) => fetchPhotoImage(url))),
  ]);
  const photos = data.inspection.inspection_photos.map((photo, i) => ({ image: photoImages[i], caption: photo.caption || "" }));

  return { bytes: await buildInspectionReportPdf(data, { logo, signature, photos }), ...common };
}
