import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { resolvePathwayCertRef } from "@/lib/business";
import { attachmentHeader, jobDocumentName } from "@/lib/downloadName";
import { buildJobArchive, type ArchiveInspection, type ArchiveItem } from "@/lib/archive/jobArchive";
import { buildApprovalSet } from "@/lib/pdf/approvalSet";
import type { Job, Firm } from "@/types/db";

// A job's complete archive, as one zip: every document the client sent,
// every earlier version of it, the inspection photos and reports, the
// signed approval, and a plain-text summary of the job itself.
//
// This is the firm's own copy. A certifier has to hold these records for
// years — longer than any subscription — so it has to be possible to take
// them out of the software and keep them somewhere else.

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!rawJob) return NextResponse.json({ error: "not found" }, { status: 404 });
  const job = rawJob as Job;

  const [{ data: firm }, { data: checklists }, { data: inspections }, { data: versions }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
    supabase
      .from("checklists")
      .select("id, kind, checklist_items(*, checklist_item_files(*))")
      .eq("job_id", jobId)
      .order("sort_order", { referencedTable: "checklist_items" })
      .order("created_at", { referencedTable: "checklist_items" }),
    supabase.from("inspections").select("*, defects(*), inspection_photos(*)").eq("job_id", jobId).order("created_at"),
    supabase.from("pathway_certificate_versions").select("*").eq("job_id", jobId).order("version"),
  ]);

  const d = job.details || {};
  const projRef = d.projectNumber || job.id.slice(0, 8);
  const activeVersion = (versions || []).find((v) => v.version === job.pathway_version);
  const reference = resolvePathwayCertRef(activeVersion?.cert_ref, job.pathway, projRef, job.pathway_version);

  // Every checklist on the job, not just the pathway one: the NOC and OC
  // documents are as much a part of the record as the approval's.
  const items = (checklists || []).flatMap((c) => ((c.checklist_items as never[]) || []) as ArchiveItem[]);

  // Read through the request's own client, so a file the certifier cannot
  // see is a file the archive does not contain.
  const fetchFile = async (path: string): Promise<Uint8Array | null> => {
    const url = await signedUrl(path);
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  };

  const approvalSet = job.pathway_generated ? await buildApprovalSet(jobId, profile) : null;

  const bytes = await buildJobArchive({
    job,
    reference,
    firmName: (firm as Firm | null)?.name || "",
    items,
    inspections: ((inspections || []) as ArchiveInspection[]),
    // The certificate as it was issued, which is the most important
    // record in the archive. Only for a job that has one — an approval
    // that cannot be assembled leaves the rest of the archive intact.
    approval: approvalSet ? { name: approvalSet.fileName, bytes: approvalSet.bytes } : null,
    fetchFile,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": attachmentHeader(jobDocumentName(reference, job.address || "", "Archive", "zip")),
      "Cache-Control": "no-store",
    },
  });
}
