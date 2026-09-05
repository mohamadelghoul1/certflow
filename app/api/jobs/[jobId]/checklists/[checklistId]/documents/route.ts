import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchStoredFile } from "@/lib/storage";
import { withinLimit, downloadBucket, HEAVY_DOWNLOAD_LIMIT } from "@/lib/rateLimit";
import { attachmentHeader, jobDocumentName } from "@/lib/downloadName";
import { resolvePathwayCertRef } from "@/lib/business";
import { buildChecklistZip, documentEntries, type NamedItem } from "@/lib/archive/checklistDocuments";
import type { Job } from "@/types/db";

// Everything on one checklist, as a single zip.
//
// Read through the certifier's own session, so row security decides
// whose documents these are rather than this route being trusted to ask
// for the right job.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string; checklistId: string }> }) {
  const { jobId, checklistId } = await params;
  const { profile, userId } = await requireProfile("certifier");
  const supabase = await createClient();

  // Pulling down and zipping a whole checklist is as heavy as the
  // approved set, and shares its ceiling.
  if (!(await withinLimit(supabase, downloadBucket(userId), HEAVY_DOWNLOAD_LIMIT))) {
    return NextResponse.json({ error: "That is a lot of downloads in a short time. Give it a few minutes and try again." }, { status: 429 });
  }

  const [{ data: rawJob }, { data: checklist }, { data: versions }] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", profile.firm_id).single(),
    supabase
      .from("checklists")
      .select("id, kind, job_id, checklist_items(*, checklist_item_files(*))")
      .eq("id", checklistId)
      .eq("job_id", jobId)
      .order("sort_order", { referencedTable: "checklist_items" })
      .order("created_at", { referencedTable: "checklist_items" })
      .single(),
    supabase.from("pathway_certificate_versions").select("version, cert_ref").eq("job_id", jobId),
  ]);

  if (!rawJob || !checklist) return NextResponse.json({ error: "not found" }, { status: 404 });
  const job = rawJob as Job;

  const items = ((checklist.checklist_items as NamedItem[] | null) || []).filter(Boolean);
  const entries = documentEntries(items);
  if (entries.length === 0) {
    return NextResponse.json({ error: "There are no documents on this checklist yet." }, { status: 404 });
  }

  const { bytes, included } = await buildChecklistZip(entries, async (path) => (await fetchStoredFile(path, supabase))?.bytes || null);

  const active = (versions || []).find((v) => v.version === job.pathway_version);
  const reference = resolvePathwayCertRef(active?.cert_ref, job.pathway, job.details?.projectNumber || job.id.slice(0, 8), job.pathway_version);
  const stage = checklist.kind === "noc" ? "NOC" : checklist.kind === "oc" ? "Occupation Certificate" : job.pathway;
  const fileName = jobDocumentName(reference, job.address || "", `${stage} Documents`, "zip");

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": attachmentHeader(fileName),
      "X-Certlyn-Documents": String(included),
    },
  });
}
