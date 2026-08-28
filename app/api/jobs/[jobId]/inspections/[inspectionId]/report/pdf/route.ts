import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { inspectionReportPdf } from "@/lib/pdf/inspectionReportFile";
import { attachmentHeader } from "@/lib/downloadName";

// The inspection report as a PDF, laid out by CertFlow rather than by the
// browser's print dialog — so the margins, page breaks and letterhead are
// the same ones every other document from this job carries. The assembly
// itself lives in lib/pdf/inspectionReportFile.ts, because the
// Occupation Certificate set needs the same thing.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string; inspectionId: string }> }) {
  const { jobId, inspectionId } = await params;
  const { profile } = await requireProfile("certifier");

  const report = await inspectionReportPdf(jobId, inspectionId, profile.firm_id);
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(report.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentHeader(report.fileName),
      "Cache-Control": "no-store",
    },
  });
}
