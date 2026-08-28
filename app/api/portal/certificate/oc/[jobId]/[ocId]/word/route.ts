import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOcCertificateData } from "@/lib/certificates/ocData";
import { fetchImageAsset } from "@/lib/docx/fetchImageAsset";
import { buildOcCertificateDocx } from "@/lib/docx/ocCertificate";
import { certificatesDownloadable } from "@/lib/portalAccess";

// The client's own copy of an Occupation Certificate. Same layered
// authorisation as the pathway route next door — signed-in client, then
// the job and the OC record are both read through the client's own RLS
// session, then the record must have been sent to them — before the admin
// client is used to assemble the document. See that route for the full
// reasoning.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string; ocId: string }> }) {
  const { jobId, ocId } = await params;
  await requireProfile("client");

  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("id, firm_id").eq("id", jobId).single();
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Released per OC record rather than per job, so this is checked on the
  // record itself — still through the client's session, so an OC belonging
  // to some other job can't be pulled through this one's id.
  const { data: record } = await supabase.from("oc_records").select("id, sent_to_client").eq("id", ocId).eq("job_id", jobId).single();
  if (!record || !record.sent_to_client) return NextResponse.json({ error: "not found" }, { status: 404 });

  // The portal closes on a finished job — see lib/portalAccess. Checked
  // here as well as on the page, because a link kept from a fortnight
  // ago would otherwise still work.
  const { data: ocRecords } = await supabase.from("oc_records").select("type, generated_date, created_at").eq("job_id", jobId);
  if (!certificatesDownloadable(ocRecords || [])) return NextResponse.json({ error: "the download window for this project has closed" }, { status: 410 });

  const admin = createAdminClient();
  const data = await getOcCertificateData(jobId, ocId, job.firm_id, admin);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [logo, signature] = await Promise.all([fetchImageAsset(data.logoUrl, 64, 190), fetchImageAsset(data.signatureUrl, 68, 240)]);
  const buffer = await buildOcCertificateDocx(data, { logo, signature });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${data.projRef}-Occupation-Certificate.docx"`,
    },
  });
}
