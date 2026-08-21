import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { getOcCertificateData } from "@/lib/certificates/ocData";
import { fetchImageAsset } from "@/lib/docx/fetchImageAsset";
import { buildOcCertificateDocx } from "@/lib/docx/ocCertificate";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string; ocId: string }> }) {
  const { jobId, ocId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getOcCertificateData(jobId, ocId, profile.firm_id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [logo, signature] = await Promise.all([fetchImageAsset(data.logoUrl, 64, 190), fetchImageAsset(data.signatureUrl, 84, 280)]);

  const buffer = await buildOcCertificateDocx(data, { logo, signature });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${data.projRef}-Occupation-Certificate.docx"`,
    },
  });
}
