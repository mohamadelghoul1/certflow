import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { fetchImageAsset } from "@/lib/docx/fetchImageAsset";
import { getNeighbourLetterData } from "@/lib/certificates/neighbourLetterData";
import { buildNeighbourLetterDocx } from "@/lib/docx/neighbourLetters";
import { attachmentHeader, jobDocumentName } from "@/lib/downloadName";

// The s134 neighbour notification letter as a Word file, built entirely
// from what the job already records — site address, proposed development,
// applicant contact details — so there is nothing extra to type in.
// Available from the moment the job exists: this notice goes out when the
// application is received, well before anything is issued.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");

  const context = await getNeighbourLetterData(jobId, profile);
  if (!context) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { job, data, logoUrl, signatureUrl } = context;

  const [logo, signature] = await Promise.all([fetchImageAsset(logoUrl, 64, 190), fetchImageAsset(signatureUrl, 68, 240)]);
  const buffer = await buildNeighbourLetterDocx(data, { logo, signature });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": attachmentHeader(jobDocumentName(data.projRef, job.address || "", "Neighbour Notification", "docx")),
      "Cache-Control": "no-store",
    },
  });
}
