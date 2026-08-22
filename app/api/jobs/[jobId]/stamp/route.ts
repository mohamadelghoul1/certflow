import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { stampSheetPdf } from "@/lib/pdf/stamp";
import { buildStampDetails } from "@/lib/pdf/stampDetails";
import type { Job, Firm } from "@/types/db";

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

  const details = await buildStampDetails(supabase, job, profile, (firm || null) as Firm | null, version?.cert_ref);
  const bytes = await stampSheetPdf(details);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${details.certRef}-Stamp.pdf"`,
    },
  });
}
