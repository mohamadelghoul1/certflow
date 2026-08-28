import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withinLimit, downloadBucket, HEAVY_DOWNLOAD_LIMIT } from "@/lib/rateLimit";
import { buildOcSet } from "@/lib/pdf/ocSet";
import { attachmentHeader } from "@/lib/downloadName";
import { certificatesDownloadable } from "@/lib/portalAccess";

// The client's own copy of the complete Occupation Certificate: the
// certificate, the documents it relied on, and the inspection reports
// behind them.
//
// Authorisation happens three times over, in this order:
//   1. requireProfile("client") — must be a signed-in client.
//   2. The job and the OC record are read through the *client's own* RLS
//      session, so Postgres decides whether this client may see them.
//   3. The certificate must have been released to the client — an
//      unsent one stays invisible even to a client who can see the job.
//
// Only then does the admin client assemble the set: the firm's
// letterhead, the certifier's signature and the stored reports all sit
// outside what client RLS grants, so it cannot be built as the client
// themselves. It reads nothing that is not already on the certificate
// the client is entitled to.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string; ocId: string }> }) {
  const { jobId, ocId } = await params;
  const { profile, userId } = await requireProfile("client");

  const supabase = await createClient();
  if (!(await withinLimit(supabase, downloadBucket(userId), HEAVY_DOWNLOAD_LIMIT))) {
    return NextResponse.json({ error: "That is a lot of downloads in a short time. Give it a few minutes and try again." }, { status: 429 });
  }

  const { data: job } = await supabase.from("jobs").select("id, firm_id, deleted_at").eq("id", jobId).single();
  if (!job || job.deleted_at) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: ocRecords } = await supabase.from("oc_records").select("id, type, sent_to_client, generated_date, created_at").eq("job_id", jobId);
  const record = (ocRecords || []).find((r) => r.id === ocId);
  if (!record || !record.sent_to_client) return NextResponse.json({ error: "not found" }, { status: 404 });

  // The portal closes on a finished job — see lib/portalAccess. Checked
  // here as well as on the page, because a link kept from a fortnight ago
  // would otherwise still work.
  if (!certificatesDownloadable(ocRecords || [])) {
    return NextResponse.json({ error: "the download window for this project has closed" }, { status: 410 });
  }

  const set = await buildOcSet(jobId, ocId, profile, createAdminClient());
  if (!set) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(set.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": attachmentHeader(set.fileName), "Cache-Control": "no-store" },
  });
}
