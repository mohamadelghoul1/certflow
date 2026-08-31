import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { getPreInspectionData } from "@/lib/certificates/preInspectionData";
import { fetchImageAsset } from "@/lib/docx/fetchImageAsset";
import { buildPreInspectionReportDocx } from "@/lib/docx/preInspectionReport";
import { attachmentHeader, jobDocumentName } from "@/lib/downloadName";

// The pre-inspection report as an editable Word file — s139 for a CDC,
// s16 for a CC.
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");

  // ?mod= exports the modification's own report — its dates, and the
  // modified certificate's number.
  const data = await getPreInspectionData(jobId, profile, undefined, request.nextUrl.searchParams.get("mod"));
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [logo, signature] = await Promise.all([fetchImageAsset(data.logoUrl, 64, 190), fetchImageAsset(data.signatureUrl, 68, 240)]);
  const buffer = await buildPreInspectionReportDocx(data, { logo, signature });

  const label = data.isCdc ? "Inspection Report s139" : "Inspection Report s16";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": attachmentHeader(jobDocumentName(data.ref, data.address, label, "docx")),
      "Cache-Control": "no-store",
    },
  });
}
