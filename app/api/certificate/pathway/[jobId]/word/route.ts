import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { getPathwayCertificateData } from "@/lib/certificates/pathwayData";
import { fetchImageAsset } from "@/lib/docx/fetchImageAsset";
import { buildPathwayCertificateDocx } from "@/lib/docx/pathwayCertificate";
import { attachmentHeader, jobDocumentName } from "@/lib/downloadName";

// Generates a real .docx for the CDC/CC certificate package, server-side —
// see CertificatePackage.tsx's wordExportHref doc comment for why this
// replaced the old client-side HTML-cloning export for this document type.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getPathwayCertificateData(jobId, profile.firm_id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [logo, signature] = await Promise.all([fetchImageAsset(data.logoUrl, 64, 190), fetchImageAsset(data.signatureUrl, 68, 240)]);

  const buffer = await buildPathwayCertificateDocx(data, { logo, signature });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": attachmentHeader(jobDocumentName(data.ref, data.job.address || "", "Certificate Package", "docx")),
      "Cache-Control": "no-store",
    },
  });
}
