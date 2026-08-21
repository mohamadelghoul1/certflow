import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { getInspectionReportData } from "@/lib/certificates/inspectionReportData";
import { fetchImageAsset, fetchImageAssetByWidth } from "@/lib/docx/fetchImageAsset";
import { buildInspectionReportDocx } from "@/lib/docx/inspectionReport";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string; inspectionId: string }> }) {
  const { jobId, inspectionId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getInspectionReportData(jobId, inspectionId, profile.firm_id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [logo, signature, photos] = await Promise.all([
    fetchImageAsset(data.logoUrl, 64, 190),
    fetchImageAsset(data.signatureUrl, 56, 200),
    Promise.all(data.photoUrls.map((url) => fetchImageAssetByWidth(url, 260, 260))),
  ]);

  const buffer = await buildInspectionReportDocx(data, { logo, signature, photos });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Inspection-Report-${data.inspection.title.replace(/\s+/g, "-")}.docx"`,
    },
  });
}
