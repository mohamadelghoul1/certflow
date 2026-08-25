import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { resolvePathwayCertRef, formatISODate, todayISO } from "@/lib/business";
import { buildApprovalBundle, type BundleDocument } from "@/lib/pdf/bundle";
import { attachmentHeader, jobDocumentName } from "@/lib/downloadName";
import { currentDocuments, documentTitle, type ItemDocument } from "@/lib/checklistDocuments";
import { buildCertificatePackagePdf } from "@/lib/pdf/certificatePackage";
import { getPathwayCertificateData } from "@/lib/certificates/pathwayData";
import { getPreInspectionData } from "@/lib/certificates/preInspectionData";
import { buildPreInspectionReportPdf } from "@/lib/pdf/preInspectionReport";
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
    supabase.from("checklists").select("id, kind, checklist_items(*, checklist_item_files(*))").eq("job_id", jobId),
    supabase.from("pathway_certificate_versions").select("*").eq("job_id", jobId).order("version"),
  ]);

  const activeVersion = (versions || []).find((v) => v.version === job.pathway_version);
  const d = job.details || {};
  const projRef = d.projectNumber || job.id.slice(0, 8);
  const certRef = resolvePathwayCertRef(activeVersion?.cert_ref, job.pathway, projRef, job.pathway_version);

  const pathwayChecklist = (checklists || []).find((c) => c.kind === "pathway");
  const items = (((pathwayChecklist?.checklist_items as never[]) || []) as ChecklistItem[])
    // Approved, and not one the certifier has deliberately kept out of
    // the set — the signed contract being the usual case. Undefined until
    // migration 0020 has been run, which counts as included.
    .filter((i) => i.status === "approved" && i.include_in_approval !== false)
    .sort((a, b) => a.sort_order - b.sort_order);

  // One entry per document rather than per item: an item satisfied by two
  // certificates puts both into the set, each stamped where the item says
  // it needs stamping.
  type Entry = { item: ChecklistItem; doc: ItemDocument | null; total: number };
  const entries: Entry[] = items.flatMap((item): Entry[] => {
    const docs = currentDocuments(item);
    // An approved item with nothing uploaded still gets an entry, so the
    // set's closing page can name what could not be included.
    if (docs.length === 0) return [{ item, doc: null, total: 0 }];
    return docs.map((doc) => ({ item, doc, total: docs.length }));
  });

  // Fetched in parallel — a full set can be a dozen files, and doing them
  // one after another is what makes a download like this feel broken.
  const files = await Promise.all(entries.map((e) => fetchBytes(e.doc?.filePath ?? e.item.file_path)));

  const documents: BundleDocument[] = entries.map(({ item, doc, total }, idx) => ({
    title: doc ? documentTitle(item.title, doc, total) : item.title,
    preparedBy: doc?.preparedBy ?? item.prepared_by,
    reference: doc?.drawingNumber ?? item.drawing_number,
    revision: doc?.revision ?? item.revision,
    date: (doc?.documentDate ?? item.document_date) ? formatISODate((doc?.documentDate ?? item.document_date)!) : null,
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

  // The pre-inspection report, once the certifier has recorded the
  // application and inspection dates against the job. Null before then,
  // and for a job that issues no certificate of its own.
  const preInspection = await getPreInspectionData(jobId, profile);
  const hasPreInspection = Boolean(preInspection?.applicationDate && preInspection?.inspectionDate);
  let supplement: { bytes: Uint8Array; label: string } | null = null;

  if (!approval) {
    const packageData = await getPathwayCertificateData(jobId, profile.firm_id);
    if (packageData) {
      const [logo, signature] = await Promise.all([fetchPdfImage(packageData.logoUrl), fetchPdfImage(packageData.signatureUrl)]);
      // Drawn into the package itself so it follows the certificate on the
      // same letterhead, rather than arriving as a separate document
      // behind the whole approval.
      approval = {
        bytes: await buildCertificatePackagePdf(packageData, { logo, signature }, hasPreInspection ? preInspection : null),
        contentType: "application/pdf",
      };
      approvalLabel = "Approval — letters, certificate, inspections notice and Schedule 1";
    }
  } else if (hasPreInspection && preInspection) {
    // A signed upload replaces the generated package, so there is nothing
    // to draw the report inside. It follows that upload instead, still
    // ahead of the approved documents.
    const [logo, signature] = await Promise.all([fetchPdfImage(preInspection.logoUrl), fetchPdfImage(preInspection.signatureUrl)]);
    supplement = { bytes: await buildPreInspectionReportPdf(preInspection, { logo, signature }), label: `Inspection report — ${preInspection.regulationTitle}` };
  }

  const firmData = (firm || null) as Firm | null;
  const stampDetails = await buildStampDetails(supabase, job, profile, firmData, activeVersion?.cert_ref);

  const bytes = await buildApprovalBundle({
    heading: `${job.pathway} ${certRef} — approved set`,
    subheading: `${job.address || ""} · ${firmData?.name || ""} · Compiled ${formatISODate(todayISO())}`,
    approval: approval ? { bytes: approval.bytes, contentType: approval.contentType } : null,
    approvalLabel,
    supplement,
    documents,
    stampDetails,
    // The same footer line the generated approval carries — certRef minus
    // its "/01" version suffix is the project number as the documents
    // print it (e.g. CDC-26001).
    footer: { projectRef: certRef.split("/")[0], website: firmData?.website },
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentHeader(jobDocumentName(certRef, job.address || "", "Approved Set", "pdf")),
      // Renaming the reference changes this file's name, so a download
      // must never come back from a cache that predates the rename.
      "Cache-Control": "no-store",
    },
  });
}
