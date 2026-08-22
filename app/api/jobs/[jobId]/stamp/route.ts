import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { resolvePathwayCertRef, formatISODate, todayISO } from "@/lib/business";
import { stampSheetPdf, fetchStampImage } from "@/lib/pdf/stamp";
import type { Job, Firm, Certifier } from "@/types/db";

// The job's approval stamp on its own, so the certifier can see exactly
// what will be applied to the approved documents before downloading the
// combined set — and print it if they'd rather stamp a paper copy.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!rawJob) return NextResponse.json({ error: "not found" }, { status: 404 });
  const job = rawJob as Job;

  const [{ data: firm }, { data: version }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
    supabase.from("pathway_certificate_versions").select("cert_ref").eq("job_id", jobId).eq("version", job.pathway_version).single(),
  ]);
  const issuedBy = job.pathway_issued_by ? ((await supabase.from("certifiers").select("*").eq("id", job.pathway_issued_by).single()).data as Certifier | null) : null;

  const d = job.details || {};
  const certRef = resolvePathwayCertRef(version?.cert_ref, job.pathway, d.projectNumber || job.id.slice(0, 8), job.pathway_version);
  const firmData = (firm || null) as Firm | null;

  const bytes = await stampSheetPdf({
    firmName: firmData?.name || "",
    certRef,
    pathway: job.pathway,
    certifierName: issuedBy?.name || "",
    registrationNo: issuedBy?.registration_no || "",
    date: formatISODate(job.pathway_signed_at || todayISO()),
    image: await fetchStampImage(await signedUrl(firmData?.stamp_url)),
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${certRef}-Stamp.pdf"`,
    },
  });
}
