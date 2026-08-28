import { createClient } from "@/lib/supabase/server";
import { fetchStoredFile } from "@/lib/storage";
import { formatISODate, todayISO } from "@/lib/business";
import { buildApprovalBundle, type BundleDocument } from "@/lib/pdf/bundle";
import { jobDocumentName } from "@/lib/downloadName";
import { getOcCertificateData } from "@/lib/certificates/ocData";
import { buildOcPackagePdf } from "@/lib/pdf/ocPackage";
import { inspectionReportPdf } from "@/lib/pdf/inspectionReportFile";
import { fetchStampImage } from "@/lib/pdf/stamp";
import { buildStampDetails } from "@/lib/pdf/stampDetails";
import { currentDocuments, documentTitle, type ItemDocument } from "@/lib/checklistDocuments";
import type { Firm, ChecklistItem, Profile } from "@/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// The whole Occupation Certificate as one PDF: the certificate itself,
// then every document the OC checklist required, then every inspection
// report from the job behind them.
//
// The reports belong here because they are the evidence the certificate
// rests on — an OC handed over without them asks the reader to take the
// inspections on trust, and the certifier to remember to attach a dozen
// separate files by hand. Behind the checklist documents rather than in
// front of them: the documents are what the certificate relies on, the
// reports are the record of what was seen on site.

type InspectionRow = { id: string; title: string; date: string | null; sort_order?: number | null };

// An inspection with no date was never carried out, so it has no report
// to include — a booking made for next Tuesday is not evidence of
// anything. The rest go in the order they happened, which is the order a
// reader follows the build in.
export function inspectionsForSet<T extends { date: string | null; sort_order?: number | null }>(inspections: T[]): T[] {
  return inspections.filter((i) => !!i.date).sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

// `client` overrides the request-scoped RLS client. The portal passes the
// admin client, having already established that the signed-in client may
// see this certificate — the firm's letterhead, the certifier's
// signature and the stored reports all sit outside what client RLS
// grants, so the set cannot be assembled as the client themselves.
export async function buildOcSet(jobId: string, ocId: string, profile: Profile, client?: SupabaseClient): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  const supabase = client ?? (await createClient());

  const data = await getOcCertificateData(jobId, ocId, profile.firm_id, client);
  if (!data) return null;
  const { job, firm, record, ref, projRef, typeLabel } = data;

  const [{ data: checklists }, { data: inspections }] = await Promise.all([
    supabase.from("checklists").select("id, kind, checklist_items(*, checklist_item_files(*))").eq("job_id", jobId),
    supabase.from("inspections").select("id, title, date, sort_order").eq("job_id", jobId),
  ]);

  const ocChecklist = (checklists || []).find((c) => c.kind === "oc");
  const items = (((ocChecklist?.checklist_items as never[]) || []) as ChecklistItem[])
    // Approved, and not one the certifier has deliberately kept out of
    // the set. Undefined until migration 0020 has been run, which counts
    // as included.
    .filter((i) => i.status === "approved" && i.include_in_approval !== false)
    .sort((a, b) => a.sort_order - b.sort_order);

  // One entry per document rather than per item: an item satisfied by two
  // certificates puts both into the set.
  type Entry = { item: ChecklistItem; doc: ItemDocument | null; total: number };
  const entries: Entry[] = items.flatMap((item): Entry[] => {
    const docs = currentDocuments(item);
    // An approved item with nothing uploaded still gets an entry, so the
    // set's closing page can name what could not be included.
    if (docs.length === 0) return [{ item, doc: null, total: 0 }];
    return docs.map((doc) => ({ item, doc, total: docs.length }));
  });

  const carriedOut = inspectionsForSet((inspections || []) as InspectionRow[]);

  // Everything at once: the checklist documents, the OC's own letterhead
  // images, and every inspection report. A set of a dozen inspections
  // fetched one after another is what makes a download like this feel
  // broken.
  const [files, logo, signature, reports] = await Promise.all([
    Promise.all(entries.map((e) => fetchStoredFile(e.doc?.filePath ?? e.item.file_path, client))),
    fetchStampImage(data.logoUrl),
    fetchStampImage(data.signatureUrl),
    Promise.all(carriedOut.map((i) => inspectionReportPdf(jobId, i.id, profile.firm_id, client))),
  ]);

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
      item.stamp_x !== null && item.stamp_y !== null ? { x: Number(item.stamp_x), y: Number(item.stamp_y), scale: Number(item.stamp_scale ?? 1) } : null,
  }));

  // The reports follow, never stamped — an inspection report is our own
  // document, and a stamp belongs on somebody else's.
  carriedOut.forEach((inspection, idx) => {
    const report = reports[idx];
    documents.push({
      title: `Inspection report — ${inspection.title}`,
      date: inspection.date ? formatISODate(inspection.date) : null,
      bytes: report?.bytes || null,
      contentType: "application/pdf",
      stamp: false,
    });
  });

  // The certificate that leads the set: the signed copy the certifier
  // uploaded when there is one, since that upload is the official
  // document, and otherwise the generated package — council letter,
  // applicant letter and the certificate with its documents relied upon.
  const uploaded = record.approval_uploaded ? await fetchStoredFile(record.approval_file_path, client) : null;
  const approval = uploaded || { bytes: await buildOcPackagePdf(data, { logo, signature }), contentType: "application/pdf" };
  const approvalLabel = uploaded ? "Signed Occupation Certificate (uploaded)" : `${typeLabel} — letters and certificate`;

  const firmData = (firm || null) as Firm | null;
  const stampDetails = await buildStampDetails(supabase, job, profile, firmData);

  const bytes = await buildApprovalBundle({
    heading: `${typeLabel} ${ref} — issued set`,
    subheading: `${job.address || ""} · ${firmData?.name || ""} · Compiled ${formatISODate(todayISO())}`,
    approval,
    approvalLabel,
    documents,
    stampDetails,
    footer: { projectRef: projRef, website: firmData?.website },
  });

  return { bytes, fileName: jobDocumentName(ref, job.address || "", `${typeLabel} Set`, "pdf") };
}
