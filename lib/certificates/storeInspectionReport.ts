import { getInspectionReportData } from "@/lib/certificates/inspectionReportData";
import { buildInspectionReportPdf } from "@/lib/pdf/inspectionReport";
import { fetchStampImage } from "@/lib/pdf/stamp";
import { fetchPhotoImage } from "@/lib/images/photo";
import type { SupabaseClient } from "@supabase/supabase-js";

// Builds the inspection report and keeps it as a file.
//
// A signed report cannot change until it is reopened, so rebuilding it on
// every download — the job, the inspection, the certifier, signed links
// for the letterhead, the signature and every photo, then the PDF — is a
// wait for something already decided. On a phone at the end of a site
// visit that wait is the whole experience of the feature.
//
// Built once at the moment of signing instead, which is a moment the
// certifier is not watching: signing flips on the press and this happens
// behind it.

export async function storeSignedInspectionReport(supabase: SupabaseClient, jobId: string, inspectionId: string, firmId: string): Promise<string | null> {
  const data = await getInspectionReportData(jobId, inspectionId, firmId);
  if (!data) return null;

  const [logo, signature, photoImages] = await Promise.all([
    fetchStampImage(data.logoUrl),
    fetchStampImage(data.signatureUrl),
    Promise.all(data.photoUrls.map((url) => fetchPhotoImage(url))),
  ]);

  const photos = data.inspection.inspection_photos.map((photo, i) => ({ image: photoImages[i], caption: photo.caption || "" }));
  const bytes = await buildInspectionReportPdf(data, { logo, signature, photos });

  // A fresh path each time rather than overwriting: a signed report is a
  // record, and the storage links handed out for the previous one should
  // keep pointing at the document that was actually signed.
  const path = `${firmId}/${jobId}/inspections/${inspectionId}/report-${Date.now()}.pdf`;
  const { error } = await supabase.storage.from("certflow-files").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (error) return null;

  return path;
}
