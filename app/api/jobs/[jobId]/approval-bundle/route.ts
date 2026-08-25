import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { withinLimit, downloadBucket, HEAVY_DOWNLOAD_LIMIT } from "@/lib/rateLimit";
import { buildApprovalSet } from "@/lib/pdf/approvalSet";
import { attachmentHeader } from "@/lib/downloadName";

// The whole approval as one PDF. The assembly itself lives in
// lib/pdf/approvalSet.ts, because the job archive needs the same thing.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile, userId } = await requireProfile("certifier");

  // Assembling this reads and stamps every document in the job, so it is
  // the most expensive thing the app does. The ceiling is far above
  // ordinary use — it only catches something stuck in a loop.
  const supabase = await createClient();
  if (!(await withinLimit(supabase, downloadBucket(userId), HEAVY_DOWNLOAD_LIMIT))) {
    return NextResponse.json({ error: "That is a lot of downloads in a short time. Give it a few minutes and try again." }, { status: 429 });
  }

  const set = await buildApprovalSet(jobId, profile);
  if (!set) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(set.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentHeader(set.fileName),
      "Cache-Control": "no-store",
    },
  });
}
