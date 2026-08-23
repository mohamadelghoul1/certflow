import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { resolvePathwayCertRef, formatISODate, todayISO } from "@/lib/business";
import { buildApprovalBundle, type BundleDocument } from "@/lib/pdf/bundle";
import { buildCertificatePackagePdf } from "@/lib/pdf/certificatePackage";
import { getPathwayCertificateData } from "@/lib/certificates/pathwayData";
import { fetchStampImage } from "@/lib/pdf/stamp";
import { buildStampDetails } from "@/lib/pdf/stampDetails";
import type { Job, Firm, Certifier, ChecklistItem } from "@/types/db";

// The whole approval as one PDF: contents page, the signed approval, then
// every approved document behind it, each stamped where the checklist says
// it needs stamping. This is the set that gets handed on — the Word
// documents CertFlow generates are unchanged and still downloaded
// separately.

async function fetchBytes(path: string | null | undefined): Promise<{ bytes: Uint8Array; contentType: string | null } | null> {
  const url = await signedUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") };
  } catch {
    return null;
  }
}

// The letterhead logo and the certifier's signature, ready to embed.
async function fetchPdfImage(url: string | null) {
  return fetchStampImage(url);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!rawJob) return NextResponse.json({ error: "not found" }, { status: 404 });
  const job = rawJob as Job;

  const [{ data: firm }, { data: checklists }, { data: versions }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
    supabase.from("checklists").select("id, kind, checklist_items(*)").eq("job_id", jobId),
    supabase.from("pathway_certificate_versions").select("*").eq("job_id", jobId).order("version"),
  ]);

  const activeVersion = (versions || []).find((v) => v.version === job.pathway_version);
  const d = job.details || {};
  const projRef = d.projectNumber || job.id.slice(0, 8);
  const certRef = resolvePathwayCertRef(activeVersion?.cert_ref, job.pathway, projRef, job.pathway_version);

  const pathwayChecklist = (checklists || []).find((c) => c.kind === "pathway");
  const items = (((pathwayChecklist?.checklist_items as never[]) || []) as ChecklistItem[])
    .filter((i) => i.status === "approved")
    .sort((a, b) => a.sort_order - b.sort_order);

  // Fetched in parallel — a full set can be a dozen files, and doing them
  // one after another is what makes a download like this feel broken.
  const files = await Promise.all(items.map((i) => fetchBytes(i.file_path)));

  const documents: BundleDocument[] = items.map((item, idx) => ({
    title: item.title,
    preparedBy: item.prepared_by,
    reference: item.drawing_number,
    revision: item.revision,
    date: item.document_date ? formatISODate(item.document_date) : null,
    bytes: files[idx]?.bytes || null,
    contentType: files[idx]?.contentType || null,
    stamp: item.requires_stamping,
    placement:
      item.stamp_x !== null && item.stamp_y !== null
        ? { x: Number(item.stamp_x), y: Number(item.stamp_y), scale: Number(item.stamp_scale ?? 1) }
        : null,
  }));

  // The approval that leads the set. The signed copy the certifier
  // uploaded wins when there is one, since that upload is the official
  // document; otherwise the whole package — council letter, applicant
  // letter, certificate, inspections notice and Schedule 1 — is generated
  // as a PDF so the set is complete either way. The Word export is
  // untouched: that one is for editing, this one is for handing over.
  const uploaded = job.pathway_approval_uploaded ? await fetchBytes(job.pathway_approval_file_path) : null;
  let approval = uploaded;
  let approvalLabel = "Signed approval (uploaded)";

  if (!approval) {
    const packageData = await getPathwayCertificateData(jobId, profile.firm_id);
    if (packageData) {
      const [logo, signature] = await Promise.all([fetchPdfImage(packageData.logoUrl), fetchPdfImage(packageData.signatureUrl)]);
      approval = { bytes: await buildCertificatePackagePdf(packageData, { logo, signature }), contentType: "application/pdf" };
      approvalLabel = "Approval — letters, certificate, inspections notice and Schedule 1";
    }
  }

  const firmData = (firm || null) as Firm | null;
  const stampDetails = await buildStampDetails(supabase, job, profile, firmData, activeVersion?.cert_ref);

  const bytes = await buildApprovalBundle({
    heading: `${job.pathway} ${certRef} — approved set`,
    subheading: `${job.address || ""} · ${firmData?.name || ""} · Compiled ${formatISODate(todayISO())}`,
    approval: approval ? { bytes: approval.bytes, contentType: approval.contentType } : null,
    approvalLabel,
    documents,
    stampDetails,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${certRef}-Approved-Set.pdf"`,
    },
  });
}
