import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { withinLimit, downloadBucket, HEAVY_DOWNLOAD_LIMIT } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOcCertificateData } from "@/lib/certificates/ocData";
import { buildOcPackagePdf } from "@/lib/pdf/ocPackage";
import { fetchStampImage } from "@/lib/pdf/stamp";
import { certificatesDownloadable } from "@/lib/portalAccess";
import { attachmentHeader, jobDocumentName } from "@/lib/downloadName";

// The client's own copy of an Occupation Certificate, as a PDF — the
// finished document rather than the editable one. Same layered
// authorisation as the Word route next door: signed-in client, the job
// and the OC record read through their own RLS session, and the record
// released to them, before the admin client assembles anything.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string; ocId: string }> }) {
  const { jobId, ocId } = await params;
  const { userId } = await requireProfile("client");

  const supabase = await createClient();
  // The same ceiling the certifier's own downloads sit behind — this
  // builds the certificate from scratch on every request.
  if (!(await withinLimit(supabase, downloadBucket(userId), HEAVY_DOWNLOAD_LIMIT))) {
    return NextResponse.json({ error: "That is a lot of downloads in a short time. Give it a few minutes and try again." }, { status: 429 });
  }
  const { data: job } = await supabase.from("jobs").select("id, firm_id").eq("id", jobId).single();
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: record } = await supabase.from("oc_records").select("id, sent_to_client").eq("id", ocId).eq("job_id", jobId).single();
  if (!record || !record.sent_to_client) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: ocRecords } = await supabase.from("oc_records").select("type, generated_date, created_at").eq("job_id", jobId);
  if (!certificatesDownloadable(ocRecords || [])) return NextResponse.json({ error: "the download window for this project has closed" }, { status: 410 });

  const admin = createAdminClient();
  const data = await getOcCertificateData(jobId, ocId, job.firm_id, admin);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [logo, signature] = await Promise.all([fetchStampImage(data.logoUrl), fetchStampImage(data.signatureUrl)]);
  const bytes = await buildOcPackagePdf(data, { logo, signature });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentHeader(jobDocumentName(data.ref, data.job.address || "", `${data.typeLabel}`, "pdf")),
      "Cache-Control": "no-store",
    },
  });
}
