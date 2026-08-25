import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { getInspectionReportData } from "@/lib/certificates/inspectionReportData";
import { buildInspectionReportPdf } from "@/lib/pdf/inspectionReport";
import { fetchStampImage } from "@/lib/pdf/stamp";
import { attachmentHeader, jobDocumentName } from "@/lib/downloadName";

// The inspection report as a PDF, laid out by CertFlow rather than by the
// browser's print dialog — so the margins, page breaks and letterhead are
// the same ones every other document from this job carries.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string; inspectionId: string }> }) {
  const { jobId, inspectionId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getInspectionReportData(jobId, inspectionId, profile.firm_id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  // In parallel: a report with a dozen photos fetched one after another is
  // what makes a download like this feel broken.
  const [logo, signature, photoImages] = await Promise.all([
    fetchStampImage(data.logoUrl),
    fetchStampImage(data.signatureUrl),
    Promise.all(data.photoUrls.map((url) => fetchStampImage(url))),
  ]);

  const photos = data.inspection.inspection_photos.map((photo, i) => ({ image: photoImages[i], caption: photo.caption || "" }));
  const bytes = await buildInspectionReportPdf(data, { logo, signature, photos });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentHeader(jobDocumentName(data.certRef, data.job.address || "", `Inspection Report - ${data.inspection.title}`, "pdf")),
      "Cache-Control": "no-store",
    },
  });
}
