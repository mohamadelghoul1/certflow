import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { withinLimit, downloadBucket, HEAVY_DOWNLOAD_LIMIT } from "@/lib/rateLimit";
import { buildOcSet } from "@/lib/pdf/ocSet";
import { attachmentHeader } from "@/lib/downloadName";

// The whole Occupation Certificate as one PDF — the certificate, the
// documents the OC checklist required, then every inspection report.
// The assembly lives in lib/pdf/ocSet.ts, because the client portal
// hands out the same set.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string; ocId: string }> }) {
  const { jobId, ocId } = await params;
  const { profile, userId } = await requireProfile("certifier");

  // Assembling this reads every document on the job and rebuilds any
  // unsigned inspection report, so it is among the most expensive things
  // the app does. The ceiling is far above ordinary use — it only
  // catches something stuck in a loop.
  const supabase = await createClient();
  if (!(await withinLimit(supabase, downloadBucket(userId), HEAVY_DOWNLOAD_LIMIT))) {
    return NextResponse.json({ error: "That is a lot of downloads in a short time. Give it a few minutes and try again." }, { status: 429 });
  }

  const set = await buildOcSet(jobId, ocId, profile);
  if (!set) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(set.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": attachmentHeader(set.fileName), "Cache-Control": "no-store" },
  });
}
