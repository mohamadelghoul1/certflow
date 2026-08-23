import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPathwayCertificateData } from "@/lib/certificates/pathwayData";
import { fetchImageAsset } from "@/lib/docx/fetchImageAsset";
import { buildPathwayCertificateDocx } from "@/lib/docx/pathwayCertificate";

// The client's own copy of the CDC/CC certificate.
//
// Authorisation deliberately happens twice over, in this order:
//   1. requireProfile("client") — must be a signed-in client.
//   2. The job is read through the *client's own* RLS session, so Postgres
//      decides whether this client may see this job at all. A client who
//      isn't attached to it simply gets no row.
//   3. pathway_sent_to_client must be true — the certifier releases a
//      certificate explicitly, and an unsent one stays invisible even to a
//      client who can otherwise see the job.
//
// Only after all three does the admin client get involved, purely to
// assemble the document: the firm's letterhead row and the certifier's
// signature file both sit outside what client RLS grants, so the document
// can't be built as the client themselves. It reads nothing that isn't
// already printed on the certificate the client is entitled to.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  await requireProfile("client");

  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("id, firm_id, pathway_sent_to_client").eq("id", jobId).single();
  if (!job || !job.pathway_sent_to_client) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();
  const data = await getPathwayCertificateData(jobId, job.firm_id, admin);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [logo, signature] = await Promise.all([fetchImageAsset(data.logoUrl, 64, 190), fetchImageAsset(data.signatureUrl, 68, 240)]);
  const buffer = await buildPathwayCertificateDocx(data, { logo, signature });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${data.projRef}-Certificate.docx"`,
    },
  });
}
