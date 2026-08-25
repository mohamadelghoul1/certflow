import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { buildApprovalSet } from "@/lib/pdf/approvalSet";
import { attachmentHeader } from "@/lib/downloadName";

// The whole approval as one PDF. The assembly itself lives in
// lib/pdf/approvalSet.ts, because the job archive needs the same thing.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");

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
