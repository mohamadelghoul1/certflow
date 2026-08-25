import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { getNeighbourLetterData } from "@/lib/certificates/neighbourLetterData";
import { buildNeighbourLetterPdf } from "@/lib/pdf/neighbourLetter";
import { fetchStampImage } from "@/lib/pdf/stamp";
import { attachmentHeader, jobDocumentName } from "@/lib/downloadName";

// The s134 neighbour notification as a print-ready PDF. Same letter as
// the Word export, from the same job details — that one is for editing
// before it goes out, this one for printing a copy per letterbox.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");

  const context = await getNeighbourLetterData(jobId, profile);
  if (!context) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { job, data, logoUrl, signatureUrl } = context;

  const [logo, signature] = await Promise.all([fetchStampImage(logoUrl), fetchStampImage(signatureUrl)]);
  const bytes = await buildNeighbourLetterPdf(data, { logo, signature });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentHeader(jobDocumentName(data.projRef, job.address || "", "Neighbour Notification", "pdf")),
      "Cache-Control": "no-store",
    },
  });
}
