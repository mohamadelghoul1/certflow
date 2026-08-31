import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { withinLimit, downloadBucket, HEAVY_DOWNLOAD_LIMIT } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPathwayCertificateData } from "@/lib/certificates/pathwayData";
import { buildCertificatePackagePdf } from "@/lib/pdf/certificatePackage";
import { fetchStampImage } from "@/lib/pdf/stamp";
import { certificatesDownloadable } from "@/lib/portalAccess";
import { attachmentHeader, jobDocumentName } from "@/lib/downloadName";

// The client's own copy of the CDC/CC, as a PDF.
//
// A PDF rather than the Word file next door: a certificate handed to the
// person it was issued to should be a finished document, not an editable
// one. The Word export stays where it belongs — with the certifier, for
// editing before the certificate goes out.
//
// Authorisation is the same three steps as that route: a signed-in
// client, the job read through their own RLS session, and the
// certificate released to them. Only then does the admin client
// assemble the document, because the firm's letterhead and the
// certifier's signature sit outside what client RLS grants.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { userId } = await requireProfile("client");

  const supabase = await createClient();
  // The same ceiling the certifier's own downloads sit behind: each of
  // these builds a certificate from scratch, and nothing else stopped a
  // signed-in client — or a stolen session — asking for it in a loop.
  if (!(await withinLimit(supabase, downloadBucket(userId), HEAVY_DOWNLOAD_LIMIT))) {
    return NextResponse.json({ error: "That is a lot of downloads in a short time. Give it a few minutes and try again." }, { status: 429 });
  }
  const { data: job } = await supabase.from("jobs").select("id, firm_id, pathway_version, pathway_sent_to_client").eq("id", jobId).single();
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  // The certificate is generated from the job as it stands, so it only
  // speaks for the version that is currently active. It is handed over
  // only when that active version is one actually sent to this client —
  // otherwise a newer certificate, still being prepared, would go out
  // under the number of the one they were issued.
  const admin = createAdminClient();
  const { data: activeVersion } = await admin
    .from("pathway_certificate_versions")
    .select("sent_to_client")
    .eq("job_id", jobId)
    .eq("version", job.pathway_version)
    .maybeSingle();
  const released = (activeVersion as { sent_to_client?: boolean } | null)?.sent_to_client ?? job.pathway_sent_to_client;
  if (!released) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: ocRecords } = await supabase.from("oc_records").select("type, generated_date, created_at").eq("job_id", jobId);
  if (!certificatesDownloadable(ocRecords || [])) return NextResponse.json({ error: "the download window for this project has closed" }, { status: 410 });

  const data = await getPathwayCertificateData(jobId, job.firm_id, admin);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [logo, signature] = await Promise.all([fetchStampImage(data.logoUrl), fetchStampImage(data.signatureUrl)]);
  const bytes = await buildCertificatePackagePdf(data, { logo, signature });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentHeader(jobDocumentName(data.ref, data.job.address || "", "Certificate", "pdf")),
      "Cache-Control": "no-store",
    },
  });
}
