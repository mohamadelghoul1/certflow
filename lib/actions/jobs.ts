"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PRIOR_APPROVAL_DOCUMENTS, INSPECTION_LIBRARY, defaultCriticalStageInspections, normalizeCriticalStageInspections, epiForCodeParts } from "@/lib/constants";
import { todayISO, normalizePortalRef, portalRefKindFor, type PortalRefKind, type Pathway } from "@/lib/business";
import { notifyJobClient } from "@/lib/email";
import type { ActionState } from "@/lib/actions/auth";
import { missingJobFields, missingFieldsMessage } from "@/lib/validation/job";
import { insertChecklistItems, reorderedIds } from "@/lib/checklists";
import { detailsPatchFromForm } from "@/lib/jobDetails";
import { mergeJobDetailsInDb } from "@/lib/actions/mergeDetails";
import { recordAuditEvent } from "@/lib/audit";
import { isUnknownColumn } from "@/lib/softDelete";
import type { JobDetails, CriticalStageInspection } from "@/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// Not exported — a plain helper, not a server action — even though this
// file is "use server". Reads the firm's own editable document library
// (Settings -> Document Library) instead of a fixed list shared by every firm.
async function firmLibrary(supabase: SupabaseClient, firmId: string, pathway: string) {
  const { data } = await supabase
    .from("document_library_items")
    .select("id, title, description, category")
    .eq("firm_id", firmId)
    .eq("pathway", pathway)
    .order("sort_order");
  return data || [];
}

// Floor areas and similar measurements are stored as free text so the
// certifier can type them the way they appear on the plans. People write
// "123.4", "1,234", "1234 m2" or "1,234.5m²" — all of which mean the same
// number — so we keep the digits and a single decimal point and drop the
// thousands separators and unit suffix. Anything that isn't recognisably a
// number is kept verbatim rather than silently blanked.
function numericText(value: FormDataEntryValue | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/,/g, "").replace(/\s*(m2|m²|sqm|sq\.?\s*m)\s*$/i, "").trim();
  return /^\d*\.?\d+$/.test(cleaned) ? cleaned : raw;
}

// Shared by the New Job intake form and the Details-tab edit form — same
// full field set as the prototype's single JobForm (used for both create
// and edit). CDC's relevant instrument/part of code are computed from the
// ticked SEPP code parts rather than typed in directly.
function extractJobDetails(formData: FormData, pathway: Pathway): JobDetails {
  const codeParts = formData.getAll("codeParts").map(String);
  const relevantInstrument = pathway === "CDC" && codeParts.length > 0 ? epiForCodeParts(codeParts) : String(formData.get("relevantInstrument") || "");
  const relevantPartOfCode = pathway === "CDC" && codeParts.length > 0 ? codeParts.join(", ") : String(formData.get("relevantPartOfCode") || "");

  return {
    projectNumber: String(formData.get("projectNumber") || ""),
    zoning: String(formData.get("zoning") || ""),
    bcaVersion: String(formData.get("bcaVersion") || ""),
    bcaVolumes: formData.getAll("bcaVolumes").map(String),
    contact: {
      nameOrCompany: String(formData.get("contact_nameOrCompany") || ""),
      title: String(formData.get("contact_title") || ""),
      givenNames: String(formData.get("contact_givenNames") || ""),
      surname: String(formData.get("contact_surname") || ""),
      phone: String(formData.get("contact_phone") || ""),
      mobile: String(formData.get("contact_mobile") || ""),
      email: String(formData.get("contact_email") || ""),
    },
    applicantAddress: {
      streetNumber: String(formData.get("applicantAddress_streetNumber") || ""),
      street: String(formData.get("applicantAddress_street") || ""),
      suburb: String(formData.get("applicantAddress_suburb") || ""),
      state: String(formData.get("applicantAddress_state") || "NSW"),
      postcode: String(formData.get("applicantAddress_postcode") || ""),
    },
    ownerSameAsApplicant: formData.get("ownerSameAsApplicant") === "on",
    owner: {
      name: String(formData.get("owner_name") || ""),
      phone: String(formData.get("owner_phone") || ""),
      address: {
        streetNumber: String(formData.get("owner_streetNumber") || ""),
        street: String(formData.get("owner_street") || ""),
        suburb: String(formData.get("owner_suburb") || ""),
        state: String(formData.get("owner_state") || "NSW"),
        postcode: String(formData.get("owner_postcode") || ""),
      },
    },
    council: {
      lga: String(formData.get("council_lga") || ""),
      address: {
        streetNumber: String(formData.get("council_streetNumber") || ""),
        street: String(formData.get("council_street") || ""),
        suburb: String(formData.get("council_suburb") || ""),
        state: String(formData.get("council_state") || "NSW"),
        postcode: String(formData.get("council_postcode") || ""),
      },
      contact: {
        phone: String(formData.get("council_phone") || ""),
        email: String(formData.get("council_email") || ""),
      },
    },
    proposal: {
      classifications: formData.getAll("classifications").map(String),
      constructionType: String(formData.get("constructionType") || "N/A"),
      dwellingsExisting: String(formData.get("dwellingsExisting") || ""),
      dwellingsDemolished: String(formData.get("dwellingsDemolished") || ""),
      dwellingsNew: String(formData.get("dwellingsNew") || ""),
      estimatedCost: String(formData.get("estimatedCost") || ""),
      storeysAbove: String(formData.get("storeysAbove") || ""),
      storeysBelow: String(formData.get("storeysBelow") || ""),
      storeysTotal: String(formData.get("storeysTotal") || ""),
      effectiveHeight: String(formData.get("effectiveHeight") || ""),
      floorAreaExisting: numericText(formData.get("floorAreaExisting")),
      floorAreaNew: numericText(formData.get("floorAreaNew")),
    },
    siteArea: numericText(formData.get("siteArea")),
    certificateDetails: {
      lotSectionDp: String(formData.get("lotSectionDp") || ""),
      planningPortalRef: normalizePortalRef(String(formData.get("planningPortalRef") || ""), portalRefKindFor(pathway)),
      relevantInstrument,
      relevantPartOfCode,
      codeParts,
      determinationDate: String(formData.get("determinationDate") || ""),
      developmentConsentNumber: String(formData.get("developmentConsentNumber") || ""),
      developmentConsentDate: String(formData.get("developmentConsentDate") || ""),
      // No longer entered on either form. Kept on the type, and carried
      // forward on save below, so jobs that already recorded references
      // keep printing them on the inspection report.
      consentReferences: "",
    },
    // Only a PC/OC job asks for these, and only it should carry them —
    // otherwise a job switched away from PC/OC would keep printing
    // another certifier's approval on its documents.
    priorApproval:
      pathway === "PC_OC"
        ? (() => {
            const type = String(formData.get("priorApprovalType") || "CDC") === "CC" ? ("CC" as const) : ("CDC" as const);
            return {
              type,
              number: String(formData.get("priorApprovalNumber") || "").trim(),
              date: String(formData.get("priorApprovalDate") || ""),
              issuedBy: String(formData.get("priorApprovalIssuedBy") || "").trim(),
              // The original certificate's Portal case: CDC series for a
              // CDC, the CFT series for a CC — same normalisation as a
              // job's own reference, so a bare number gets its prefix.
              portalRef: normalizePortalRef(String(formData.get("priorApprovalPortalRef") || ""), type),
            };
          })()
        : undefined,
  };
}

export async function createJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const pathway = String(formData.get("pathway") || "CDC") as Pathway;
  const jobTypes = formData.getAll("job_types").map(String);
  const clientId = String(formData.get("client_id") || "") || null;
  const certifierId = String(formData.get("assigned_certifier_id") || "") || null;
  const address = String(formData.get("address") || "");
  const description = String(formData.get("description") || "");
  const details = extractJobDetails(formData, pathway);

  // Checked here as well as in the browser: form validation is a
  // convenience, not a guarantee, and a job missing these can't produce a
  // certificate later.
  const missing = missingJobFields({ pathway, address, description, certifierId, details });
  if (missing.length) return { error: missingFieldsMessage(missing) };

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      firm_id: profile.firm_id,
      address,
      description,
      job_types: jobTypes,
      pathway,
      assigned_certifier_id: certifierId,
      client_id: clientId,
      details,
      critical_stage_inspections: defaultCriticalStageInspections(),
    })
    .select("id")
    .single();

  if (error || !job) return { error: error?.message || "Could not create job." };

  // Auto-populate the three standard checklists from the firm's own
  // document library (Settings -> Document Library).
  const kinds: { kind: "pathway" | "noc" | "oc"; libraryKey: string }[] = [
    { kind: "pathway", libraryKey: pathway },
    { kind: "noc", libraryKey: "NOC" },
    { kind: "oc", libraryKey: "OC" },
  ];

  for (const { kind, libraryKey } of kinds) {
    const { data: checklist } = await supabase.from("checklists").insert({ job_id: job.id, kind }).select("id").single();
    if (!checklist) continue;
    // A PC/OC job has no application to assess, so its first checklist
    // collects the previous certifier's approval instead of this firm's
    // document library for a pathway it never follows.
    const library = libraryKey === "PC_OC" ? PRIOR_APPROVAL_DOCUMENTS : await firmLibrary(supabase, profile.firm_id, libraryKey);
    const items = library.map((doc, idx) => ({
      checklist_id: checklist.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      sort_order: idx,
      // Keeps the link back to the library item, which is where the blank
      // form for this document lives. The PC/OC starter list is a constant
      // rather than library rows, so those items have no form to offer.
      template_library_item_id: "id" in doc ? doc.id : null,
    }));
    await insertChecklistItems(supabase, items);
  }

  const inspections = INSPECTION_LIBRARY.map((i) => ({
    job_id: job.id,
    title: i.title,
    description: i.desc,
    inspector_certifier_id: certifierId,
  }));
  await supabase.from("inspections").insert(inspections);

  redirect(`/jobs/${job.id}`);
}

export async function updateJobDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const pathway = String(formData.get("pathway") || "CDC") as Pathway;

  // Sent as a patch rather than as the whole record — see
  // detailsPatchFromForm for what this form does and doesn't manage.
  const patch = detailsPatchFromForm(extractJobDetails(formData, pathway));

  // The critical stage inspections and the portal client travel with this
  // form rather than saving as they're changed, so nothing on the Details
  // tab is written until Save details is pressed.
  const inspectionRows = formData.getAll("criticalStageInspections").map(String);
  const criticalStageInspections = inspectionRows.length
    ? normalizeCriticalStageInspections(
        inspectionRows
          .map((row) => {
            try {
              return JSON.parse(row);
            } catch {
              return null;
            }
          })
          .filter(Boolean)
      )
    : undefined;

  const clientId = formData.has("client_id") ? String(formData.get("client_id") || "") || null : undefined;
  const address = String(formData.get("address") || "");
  const description = String(formData.get("description") || "");

  await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, patch);
  await supabase
    .from("jobs")
    .update({
      address,
      description,
      ...(criticalStageInspections ? { critical_stage_inspections: criticalStageInspections } : {}),
      ...(clientId !== undefined ? { client_id: clientId } : {}),
    })
    .eq("id", jobId)
    .eq("firm_id", profile.firm_id);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
  revalidatePath("/certificate/oc/[jobId]/[ocId]", "page");
  revalidatePath("/jobs/[jobId]/inspections/[inspectionId]/report", "page");
  return undefined;
}

export async function removeChecklistItem(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("checklist_items").delete().eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addChecklistItems(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const checklistId = String(formData.get("checklist_id"));
  const jobId = String(formData.get("job_id"));
  const titles = formData.getAll("title").map(String);
  const descs = formData.getAll("desc").map(String);
  const categories = formData.getAll("category").map(String);
  // Empty for the one-off documents typed into the picker, which have no
  // library item behind them and so no blank form to hand over.
  const libraryItemIds = formData.getAll("library_item_id").map(String);

  const { data: checklist } = await supabase.from("checklists").select("id, jobs!inner(firm_id)").eq("id", checklistId).single();
  if (!checklist) return;

  const items = titles.map((title, i) => ({
    checklist_id: checklistId,
    title,
    description: descs[i] || "",
    category: categories[i] || "Other",
    template_library_item_id: libraryItemIds[i] || null,
  }));
  await insertChecklistItems(supabase, items);
  revalidatePath(`/jobs/${jobId}`);
}

// Moves one document up or down its checklist. The checklist's order is
// the order the approved set is assembled in and Schedule 1 lists them,
// so this is about the finished document, not just tidiness on screen.
//
// Every position is rewritten rather than just the two being swapped:
// items added through "+ Request documents" all arrived with sort_order
// 0, so a checklist that has never been through migration 0020 sorts
// itself out the first time anything is moved.
export async function moveChecklistItem(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const direction = String(formData.get("direction"));

  const { data: item } = await supabase.from("checklist_items").select("id, checklist_id").eq("id", itemId).single();
  if (!item) return;

  const { data: siblings } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("checklist_id", item.checklist_id)
    .order("sort_order")
    .order("created_at");
  if (!siblings) return;

  const reordered = reorderedIds(
    siblings.map((s) => s.id),
    itemId,
    direction === "up" ? "up" : "down"
  );
  if (!reordered) return;

  await Promise.all(reordered.map((id, i) => supabase.from("checklist_items").update({ sort_order: i }).eq("id", id)));

  revalidatePath(`/jobs/${jobId}`);
}

// Keeps a document on the checklist but out of the generated approval —
// off the approved set PDF and out of Schedule 1. The document is still
// requested, uploaded, approved and stored exactly as before.
export async function toggleApprovalInclusion(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const value = formData.get("value") === "true";

  const { error } = await supabase.from("checklist_items").update({ include_in_approval: value }).eq("id", itemId);
  if (error) console.error("could not change whether the document is in the approval:", error.message);
  revalidatePath(`/jobs/${jobId}`);
}

export async function approveItem(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  // No automatic email here on purpose — approvals/amendments happen too
  // often to email on each one. Use the "Notify client of update" button
  // on the checklist instead, which sends one batched summary.
  await supabase.from("checklist_items").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

// A document uploaded on the client's behalf. Without a document number
// this replaces the item's first document; with one it replaces that
// document; "new" adds another alongside — an item satisfied by two
// certificates rather than one.
export async function certifierUploadItem(formData: FormData) {
  const { userId } = await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const filePath = String(formData.get("file_path"));
  const requested = String(formData.get("document_no") || "");

  const { data: item } = await supabase.from("checklist_items").select("version").eq("id", itemId).single();
  const version = (item?.version || 0) + 1;

  const { data: existing } = await supabase.from("checklist_item_files").select("document_no").eq("checklist_item_id", itemId);
  const highest = Math.max(0, ...((existing || []).map((f) => f.document_no ?? 1) as number[]));
  const documentNo = requested === "new" ? highest + 1 : Number(requested) || 1;

  // The item's own pointer follows the first document, which is what
  // every screen showing "the" file for an item reads.
  if (documentNo === 1) await supabase.from("checklist_items").update({ file_path: filePath, status: "submitted", version }).eq("id", itemId);
  else await supabase.from("checklist_items").update({ status: "submitted", version }).eq("id", itemId);

  // Only the newest upload of this document is in force; the ones before
  // it stay as its history, so a document replaced later can still be
  // produced.
  await supabase.from("checklist_item_files").update({ is_current: false }).eq("checklist_item_id", itemId).eq("document_no", documentNo);

  const { error: historyError } = await supabase.from("checklist_item_files").insert({
    checklist_item_id: itemId,
    file_path: filePath,
    version,
    document_no: documentNo,
    is_current: true,
    uploaded_by_role: "certifier",
    uploaded_by: userId,
  });
  // Retried without the columns migration 0023 adds: PostgREST rejects
  // the whole insert if any column is unknown, and an upload that has
  // already succeeded must not look like it failed.
  if (historyError) {
    const retry = await supabase.from("checklist_item_files").insert({
      checklist_item_id: itemId,
      file_path: filePath,
      version,
      uploaded_by_role: "certifier",
      uploaded_by: userId,
    });
    if (retry.error) console.error("could not record the document's version history:", retry.error.message);
  }

  revalidatePath(`/jobs/${jobId}`);
}

// The Schedule 1 details belonging to one document on an item. Two
// certificates under a single item rarely share a preparer, a reference
// or a date, so each carries its own.
export async function updateItemDocument(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const fileId = String(formData.get("file_id"));
  const jobId = String(formData.get("job_id"));
  const text = (name: string) => String(formData.get(name) || "").trim() || null;

  const { error } = await supabase
    .from("checklist_item_files")
    .update({
      label: text("label"),
      prepared_by: text("prepared_by"),
      drawing_number: text("drawing_number"),
      revision: text("revision"),
      document_date: text("document_date"),
    })
    .eq("id", fileId);
  if (error) console.error("could not save the document's details:", error.message);

  revalidatePath(`/jobs/${jobId}`);
}

// Drops one document from an item, with every version of it. The item
// keeps the rest; removing the last one leaves the item awaiting a
// document again, which is what it is.
export async function removeItemDocument(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const documentNo = Number(formData.get("document_no")) || 1;

  await supabase.from("checklist_item_files").delete().eq("checklist_item_id", itemId).eq("document_no", documentNo);

  // The item's pointer follows the first document, so it has to move when
  // that document is the one that just went.
  const { data: remaining } = await supabase
    .from("checklist_item_files")
    .select("file_path, document_no, is_current")
    .eq("checklist_item_id", itemId)
    .eq("is_current", true)
    .order("document_no");
  const first = (remaining || [])[0];
  await supabase.from("checklist_items").update({ file_path: first?.file_path ?? null }).eq("id", itemId);

  revalidatePath(`/jobs/${jobId}`);
}

export async function updateItemDetails(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  await supabase
    .from("checklist_items")
    .update({ title, description: String(formData.get("description") || "").trim() })
    .eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateItemMeta(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  // A document can't be dated in the future. The form's own date box
  // stops one being picked, but the value still arrives as plain text, so
  // it's re-checked here rather than trusted.
  const submittedDate = String(formData.get("document_date") || "");
  // "Today" has to be today in NSW, not in UTC — the server runs on UTC,
  // which is still yesterday for the whole Australian morning, so a
  // document correctly dated today would otherwise be pushed back a day.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
  const documentDate = submittedDate ? (submittedDate <= today ? submittedDate : today) : null;

  await supabase
    .from("checklist_items")
    .update({
      revision: String(formData.get("revision") || ""),
      document_date: documentDate,
      prepared_by: String(formData.get("prepared_by") || ""),
      drawing_number: String(formData.get("drawing_number") || ""),
      // clause_ref is deliberately not written. Its box has been removed
      // from the item's details, so the form no longer submits one, and
      // writing the empty value would wipe anything already recorded.
    })
    .eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

// Where the approval stamp sits on one document, and how big it is —
// dragged onto a preview of the plan itself rather than typed in. Also
// remembered on the firm, so the next plan starts where this one was put
// instead of back in the corner.
export async function setStampPlacement(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));

  const x = Number(formData.get("x"));
  const y = Number(formData.get("y"));
  const scale = Number(formData.get("scale"));
  // A fraction of the page and a sane size, whatever arrives.
  const clamp = (value: number, min: number, max: number) => (Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min);
  const placement = { stamp_x: clamp(x, 0, 1), stamp_y: clamp(y, 0, 1), stamp_scale: clamp(scale, 0.25, 4) };

  await supabase.from("checklist_items").update(placement).eq("id", itemId);
  await supabase.from("firms").update(placement).eq("id", profile.firm_id);
  revalidatePath(`/jobs/${jobId}`);
}

// Back to the bottom-right corner at normal size.
export async function clearStampPlacement(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("checklist_items").update({ stamp_x: null, stamp_y: null, stamp_scale: null }).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleStamping(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const value = formData.get("value") === "true";
  await supabase.from("checklist_items").update({ requires_stamping: value }).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addAmendment(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  // No automatic email here on purpose — see note in approveItem above.
  await supabase.from("amendments").insert({ checklist_item_id: itemId, text });
  revalidatePath(`/jobs/${jobId}`);
}

// Manual, batched notification — one summary email per click, instead of
// one email per approval/amendment. Mirrors the prototype's
// buildJobUpdateMailto: "X of Y documents approved — Z items need your
// attention", not a blow-by-blow log.
export async function notifyClientOfChecklist(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const checklistId = String(formData.get("checklist_id"));
  const label = String(formData.get("label") || "your project");

  const { data: items } = await supabase.from("checklist_items").select("status, amendments(resolved)").eq("checklist_id", checklistId);

  const total = items?.length || 0;
  const approved = (items || []).filter((i) => i.status === "approved").length;
  const openAmendments = (items || []).reduce((sum, i) => sum + (i.amendments || []).filter((a: { resolved: boolean }) => !a.resolved).length, 0);

  let statusLine = total > 0 ? `${approved} of ${total} documents approved` : "No documents requested yet";
  if (openAmendments > 0) statusLine += ` — ${openAmendments} item${openAmendments === 1 ? "" : "s"} require your attention`;

  await notifyJobClient(
    supabase,
    jobId,
    `${label} — status update`,
    `<p>Here&rsquo;s the current status of the <strong>${label}</strong> checklist:</p><p style="padding:12px;background:#f0fdfa;border-radius:6px">${statusLine}</p>`
  );

  await supabase.from("jobs").update({ last_notified_at: new Date().toISOString() }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

// Generic one-off milestone notification — used by the manual "Notify
// client" buttons next to a certificate/report once it's ready, instead
// of firing automatically the moment it's uploaded/marked sent.
export async function notifyClientMessage(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const subject = String(formData.get("subject") || "Update on your project");
  const message = String(formData.get("message") || "");

  await notifyJobClient(supabase, jobId, subject, `<p>${message}</p>`);
  await supabase.from("jobs").update({ last_notified_at: new Date().toISOString() }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function resolveAmendment(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const amendmentId = String(formData.get("amendment_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("amendments").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", amendmentId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function removeAmendment(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const amendmentId = String(formData.get("amendment_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("amendments").delete().eq("id", amendmentId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addCondition(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  await supabase.from("conditions_of_consent").insert({ job_id: jobId, text, date_added: todayISO() });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
  void profile;
}

export async function removeCondition(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const conditionId = String(formData.get("condition_id"));
  await supabase.from("conditions_of_consent").delete().eq("id", conditionId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
}

export async function reopenItem(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("checklist_items").update({ status: "submitted", updated_at: new Date().toISOString() }).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

// Mirrors one pathway_certificate_versions row onto the job's own
// pathway_* columns, since the certificate document page, client portal,
// dashboard tasks, and reports/audit all read those columns directly.
// Keeping this in one place means only the "currently visible" version's
// data ever has to be duplicated onto jobs.
async function mirrorVisiblePathwayVersion(
  supabase: SupabaseClient,
  jobId: string,
  version: {
    version: number;
    generated_date: string;
    issued_by: string | null;
    signed_at: string | null;
    sent_to_client: boolean;
    sent_to_client_date: string | null;
    approval_uploaded: boolean;
    approval_date: string | null;
    approval_file_path: string | null;
  } | null
) {
  if (!version) {
    await supabase
      .from("jobs")
      .update({
        pathway_generated: false,
        pathway_generated_date: null,
        pathway_issued_by: null,
        pathway_signed_at: null,
        pathway_sent_to_client: false,
        pathway_sent_to_client_date: null,
        pathway_version: 0,
        pathway_approval_uploaded: false,
        pathway_approval_date: null,
        pathway_approval_file_path: null,
        pathway_portal_reported: false,
        pathway_portal_reported_date: null,
      })
      .eq("id", jobId);
    return;
  }
  await supabase
    .from("jobs")
    .update({
      pathway_generated: true,
      pathway_generated_date: version.generated_date,
      pathway_issued_by: version.issued_by,
      pathway_signed_at: version.signed_at,
      pathway_sent_to_client: version.sent_to_client,
      pathway_sent_to_client_date: version.sent_to_client_date,
      pathway_version: version.version,
      pathway_approval_uploaded: version.approval_uploaded,
      pathway_approval_date: version.approval_date,
      pathway_approval_file_path: version.approval_file_path,
    })
    .eq("id", jobId);
}

// The NSW Planning Portal reference, entered on its own from the
// certificate panel. It is on the Details page too, but it is often the
// last thing to come back from the Portal — long after the rest of the
// job was filled in — so it can be typed in at the moment it is needed
// without leaving the tab.
// The constraints on the land — bushfire prone, flood planning area,
// heritage. Recorded against the job rather than typed into a document,
// because they change how every part of the assessment is approached and
// belong in front of the certifier from the moment the job is opened.
export async function setSiteSensitivities(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));

  // Trimmed, de-duplicated and emptied of blanks, so a stray comma or a
  // double-tick doesn't put the same constraint on the job twice.
  const sensitivities = [...new Set(formData.getAll("sensitivity").map((v) => String(v).trim()).filter(Boolean))];

  await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { siteSensitivities: sensitivities });
  revalidatePath(`/jobs/${jobId}`);
}

export async function setPlanningPortalRef(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const kind = (String(formData.get("kind") || "CDC") as PortalRefKind);
  const ref = normalizePortalRef(String(formData.get("planningPortalRef") || ""), kind);
  if (!ref) return { error: "Enter the Planning Portal reference number." };

  await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { certificateDetails: { planningPortalRef: ref } });
  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

// The two dates the pre-inspection report needs that the job doesn't
// already know: when the application was made, and when the inspection
// was carried out. Entered where the certificate is issued, for the same
// reason the Planning Portal reference is — going back to the Details tab
// for two fields at the moment of issuing is how a report goes out blank.
export async function setPreInspectionDates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const applicationDate = String(formData.get("applicationDate") || "");
  const inspectionDate = String(formData.get("inspectionDate") || "");

  await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { preInspection: { applicationDate, inspectionDate } });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pre-inspection/${jobId}`);
  return undefined;
}

export async function issuePathwayCertificate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const certifierId = String(formData.get("certifier_id") || "");
  if (!certifierId) return { error: "Select a certifier before issuing." };

  const { data: job } = await supabase.from("jobs").select("id, details").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "Project not found." };

  // The certificate carries the NSW Planning Portal reference, so it
  // cannot be issued without one. Checked here as well as in the form —
  // a disabled button is a courtesy, not a control.
  const jobDetails = (job.details || {}) as JobDetails;
  if (!jobDetails.certificateDetails?.planningPortalRef?.trim()) {
    return { error: "Enter the NSW Planning Portal reference number before issuing." };
  }

  const { data: existing } = await supabase.from("pathway_certificate_versions").select("version").eq("job_id", jobId).order("version", { ascending: false }).limit(1);
  const nextVersion = (existing?.[0]?.version || 0) + 1;
  const generatedDate = todayISO();

  await supabase.from("pathway_certificate_versions").update({ visible_to_client: false }).eq("job_id", jobId);
  const { data: newVersion, error } = await supabase
    .from("pathway_certificate_versions")
    .insert({ job_id: jobId, version: nextVersion, generated_date: generatedDate, issued_by: certifierId, visible_to_client: true })
    .select()
    .single();
  if (error || !newVersion) return { error: error?.message || "Could not issue certificate." };

  await mirrorVisiblePathwayVersion(supabase, jobId, newVersion);

  // Date of determination = the date this (or the latest re-issued)
  // certificate is generated — no separate manual entry needed.
  await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { certificateDetails: { determinationDate: generatedDate } });
  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

// Separate from issuing: generating the certificate package no longer signs
// it automatically, so the certifier can export it to Word to review/amend
// first. Signing just stamps the currently-visible version with who/when —
// it doesn't lock the checklist or letters from further edits.
export async function signPathwayCertificate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));

  const { data: job } = await supabase.from("jobs").select("id, address, pathway, pathway_version").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "Project not found." };

  const signedAt = new Date().toISOString();
  const { error: versionError, data: updatedVersions } = await supabase
    .from("pathway_certificate_versions")
    .update({ signed_at: signedAt })
    .eq("job_id", jobId)
    .eq("version", job.pathway_version)
    .select("id");
  if (versionError) return { error: versionError.message };
  if (!updatedVersions || updatedVersions.length === 0) return { error: "Could not find this certificate version to sign." };

  const { error: jobError } = await supabase.from("jobs").update({ pathway_signed_at: signedAt }).eq("id", jobId);
  if (jobError) return { error: jobError.message };

  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "certificate.signed",
    summary: `Signed the ${job.pathway} certificate (version ${job.pathway_version})`,
    jobId,
    jobAddress: job.address,
    actor: profile,
    detail: { pathway: job.pathway, version: job.pathway_version },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
  return undefined;
}

// The certificate being generated/signed never exposes it to the client on
// its own — the portal only ever shows a certificate once this is pressed,
// so a mistake can be fixed (regenerate, re-export to Word, re-sign)
// without the client ever seeing the wrong version. Regenerating always
// resets sent_to_client to false on the new version, so it stays hidden
// again until deliberately re-sent.
export async function sendPathwayCertificateToClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));

  const { data: job } = await supabase.from("jobs").select("id, address, pathway, pathway_version, pathway_signed_at, pathway_approval_uploaded").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "Project not found." };
  if (!job.pathway_signed_at && !job.pathway_approval_uploaded) return { error: "Sign the certificate (or upload a signed copy) before sending it to the client." };

  const sentDate = todayISO();
  const { error: versionError, data: updatedVersions } = await supabase
    .from("pathway_certificate_versions")
    .update({ sent_to_client: true, sent_to_client_date: sentDate })
    .eq("job_id", jobId)
    .eq("version", job.pathway_version)
    .select("id");
  if (versionError) return { error: versionError.message };
  if (!updatedVersions || updatedVersions.length === 0) return { error: "Could not find this certificate version to send." };

  const { error: jobError } = await supabase.from("jobs").update({ pathway_sent_to_client: true, pathway_sent_to_client_date: sentDate }).eq("id", jobId);
  if (jobError) return { error: jobError.message };

  await notifyJobClient(supabase, jobId, `${job.pathway} issued`, `<p>Your ${job.pathway} has been issued and is now available to view in your portal.</p>`);

  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "certificate.sent",
    summary: `Released the ${job.pathway} certificate to the client`,
    jobId,
    jobAddress: job.address,
    actor: profile,
    detail: { pathway: job.pathway, version: job.pathway_version },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
  return undefined;
}

export async function uploadPathwayApproval(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const versionId = String(formData.get("version_id"));
  const filePath = String(formData.get("file_path"));
  const approvalDate = todayISO();

  const { data: version } = await supabase
    .from("pathway_certificate_versions")
    .update({ approval_uploaded: true, approval_date: approvalDate, approval_file_path: filePath })
    .eq("id", versionId)
    .select()
    .single();

  if (version?.visible_to_client) await mirrorVisiblePathwayVersion(supabase, jobId, version);
  revalidatePath(`/jobs/${jobId}`);
}

export async function setVisiblePathwayVersion(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const versionId = String(formData.get("version_id"));

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return;

  await supabase.from("pathway_certificate_versions").update({ visible_to_client: false }).eq("job_id", jobId);
  const { data: version } = await supabase.from("pathway_certificate_versions").update({ visible_to_client: true }).eq("id", versionId).select().single();

  await mirrorVisiblePathwayVersion(supabase, jobId, version || null);
  revalidatePath(`/jobs/${jobId}`);
}

export async function deletePathwayVersion(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const versionId = String(formData.get("version_id"));

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return;

  const { data: deleted } = await supabase.from("pathway_certificate_versions").delete().eq("id", versionId).select().single();

  if (deleted?.visible_to_client) {
    const { data: remaining } = await supabase.from("pathway_certificate_versions").select("*").eq("job_id", jobId).order("version", { ascending: false }).limit(1);
    const promoted = remaining?.[0] || null;
    if (promoted) await supabase.from("pathway_certificate_versions").update({ visible_to_client: true }).eq("id", promoted.id);
    await mirrorVisiblePathwayVersion(supabase, jobId, promoted);
  }
  revalidatePath(`/jobs/${jobId}`);
}

// Overrides the auto-generated certificate reference for one version / one
// OC record. Blank clears the override, putting it back on the generated
// {PATHWAY}-{project number}/{version} form.
export async function renameCertRef(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const kind = String(formData.get("kind"));
  const recordId = String(formData.get("record_id"));
  const certRef = String(formData.get("cert_ref") || "").trim() || null;

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return;

  const table = kind === "oc" ? "oc_records" : "pathway_certificate_versions";
  await supabase.from(table).update({ cert_ref: certRef }).eq("id", recordId).eq("job_id", jobId);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
  revalidatePath("/certificate/oc/[jobId]/[ocId]", "page");
  revalidatePath("/jobs/[jobId]/inspections/[inspectionId]/report", "page");
}

export async function deleteModification(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const modificationId = String(formData.get("modification_id"));

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return;

  // The modification's checklist references it with "on delete cascade", and
  // the checklist's items cascade from the checklist in turn — so this one
  // delete takes the whole thing with it, no manual cleanup needed.
  await supabase.from("modifications").delete().eq("id", modificationId).eq("job_id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function startModification(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const reason = String(formData.get("reason") || "");

  // Deliberately creates an EMPTY checklist. Unlike the initial CDC/CC
  // assessment — where the full firm library is the right starting point,
  // since every one of those documents is genuinely needed — a modification
  // only ever concerns the handful of documents the change actually
  // affects. Pre-filling it from the library meant every modification began
  // with a long list of irrelevant items to delete. The certifier picks the
  // ones they want from the library via ChecklistSection's document picker.
  const { data: mod } = await supabase.from("modifications").insert({ job_id: jobId, reason }).select("id").single();
  if (!mod) return;
  await supabase.from("checklists").insert({ job_id: jobId, kind: "modification", modification_id: mod.id });
  revalidatePath(`/jobs/${jobId}`);
}

export async function issueModification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const modificationId = String(formData.get("modification_id"));
  const certifierId = String(formData.get("certifier_id") || "");
  if (!certifierId) return { error: "Select a certifier before issuing." };

  // A modified certificate carries the same Planning Portal reference the
  // original does, and prints it, so it is gated the same way.
  const { data: modJob } = await supabase.from("jobs").select("details").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!modJob) return { error: "Project not found." };
  if (!((modJob.details || {}) as JobDetails).certificateDetails?.planningPortalRef?.trim()) {
    return { error: "Enter the NSW Planning Portal reference number before issuing." };
  }

  const { data: mod } = await supabase.from("modifications").select("version").eq("id", modificationId).single();
  const { error } = await supabase
    .from("modifications")
    .update({ generated: true, generated_date: todayISO(), issued_by: certifierId, version: (mod?.version || 0) + 1 })
    .eq("id", modificationId);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

export async function uploadModificationApproval(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const modificationId = String(formData.get("modification_id"));
  const filePath = String(formData.get("file_path"));
  await supabase.from("modifications").update({ approval_uploaded: true, approval_date: todayISO(), approval_file_path: filePath }).eq("id", modificationId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function issueOc(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const type = String(formData.get("type")) as "partial" | "whole";
  const description = String(formData.get("description") || "");
  const certifierId = String(formData.get("certifier_id") || "");
  if (!certifierId) return { error: "Select a certifier before issuing." };

  // Each occupation certificate is its own Portal application, so the
  // reference is recorded against the certificate as it is created rather
  // than taken from the job.
  const portalRef = normalizePortalRef(String(formData.get("portal_ref") || ""), "OC");
  if (!portalRef) return { error: "Enter the NSW Planning Portal reference number before issuing." };

  const { error } = await supabase.from("oc_records").insert({ job_id: jobId, type, description, generated_date: todayISO(), issued_by: certifierId, portal_ref: portalRef });
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

export async function signOc(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const ocId = String(formData.get("oc_id"));
  const { error, data } = await supabase.from("oc_records").update({ signed_at: new Date().toISOString() }).eq("id", ocId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Could not find this Occupation Certificate to sign." };
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/oc/${jobId}/${ocId}`);
  return undefined;
}

export async function sendOcToClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const ocId = String(formData.get("oc_id"));

  const { data: record } = await supabase.from("oc_records").select("id, type, signed_at, approval_uploaded").eq("id", ocId).single();
  if (!record) return { error: "Occupation Certificate not found." };
  if (!record.signed_at && !record.approval_uploaded) return { error: "Sign the certificate (or upload a signed copy) before sending it to the client." };

  const { error, data } = await supabase.from("oc_records").update({ sent_to_client: true, sent_to_client_date: todayISO() }).eq("id", ocId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Could not find this Occupation Certificate to send." };

  await notifyJobClient(
    supabase,
    jobId,
    "Occupation Certificate issued",
    `<p>Your ${record.type === "whole" ? "Whole" : "Partial"} Occupation Certificate has been issued and is now available to view in your portal.</p>`
  );

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/oc/${jobId}/${ocId}`);
  return undefined;
}

export async function uploadOcApproval(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const ocId = String(formData.get("oc_id"));
  const filePath = String(formData.get("file_path"));
  await supabase.from("oc_records").update({ approval_uploaded: true, approval_date: todayISO(), approval_file_path: filePath }).eq("id", ocId);
  revalidatePath(`/jobs/${jobId}`);
}

// Deleting a project no longer destroys it. It leaves the jobs list, the
// dashboard counts, the reports and the client's portal straight away,
// but the row and its files stay exactly where they are, and it can be
// brought back from Projects -> Deleted at any time.
//
// A certifier has to be able to account for a job years after the fact,
// and "someone deleted it and there is no record" is not an answer. The
// deletion is written to the audit log as it happens.
export async function deleteJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile, userId } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));

  const { data: job } = await supabase.from("jobs").select("id, address").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "That job could not be found." };

  const { error } = await supabase
    .from("jobs")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", jobId)
    .eq("firm_id", profile.firm_id);
  if (error) {
    if (isUnknownColumn(error)) {
      return { error: "This database is still missing the update that makes deleting recoverable, so nothing has been deleted. Run migration 0028 in Supabase first." };
    }
    return { error: error.message };
  }

  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "job.deleted",
    summary: `Deleted the project at ${job.address || "(no address)"}`,
    jobId,
    jobAddress: job.address,
    actor: profile,
    severity: "warning",
  });

  revalidatePath("/jobs");
  revalidatePath("/jobs/deleted");
  revalidatePath("/dashboard");
  redirect("/jobs");
}

// Puts a deleted project back. Nothing was thrown away, so this is only
// clearing the two columns that hid it.
export async function restoreJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));

  const { data: job } = await supabase.from("jobs").select("id, address").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "That job could not be found." };

  const { error } = await supabase.from("jobs").update({ deleted_at: null, deleted_by: null }).eq("id", jobId).eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };

  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "job.restored",
    summary: `Restored the project at ${job.address || "(no address)"}`,
    jobId,
    jobAddress: job.address,
    actor: profile,
  });

  revalidatePath("/jobs");
  revalidatePath("/jobs/deleted");
  revalidatePath("/dashboard");
  redirect(`/jobs/${jobId}`);
}

// Destroys a deleted project for good. The database cascades the
// checklists, items, amendments, inspections, photos, certificate
// versions, OC records and shared access, so the only thing that needs
// clearing by hand is the uploaded files — they live in storage under
// {firm}/{job}/, outside the database's reach.
//
// Guarded by requiring the job's own address to be typed back: this is
// the one step in the app that genuinely cannot be undone. What it
// leaves behind is the audit entry, which is the point of writing it
// somewhere the job itself does not reach.
export async function purgeJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const typed = String(formData.get("confirm_address") || "").trim();

  const { data: job } = await supabase.from("jobs").select("id, address").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "That job could not be found." };

  const expected = (job.address || "").trim();
  if (typed.toLowerCase() !== expected.toLowerCase()) {
    return { error: "The address you typed doesn't match this job's address, so nothing has been deleted." };
  }

  // Written before the row goes, so a failure part-way through still
  // leaves a record of what was attempted.
  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "job.purged",
    summary: `Permanently deleted the project at ${job.address || "(no address)"}, including its documents`,
    jobId,
    jobAddress: job.address,
    actor: profile,
    severity: "warning",
  });

  // Storage has no recursive delete, so the paths are listed first. A
  // failure here is not fatal — the job still goes, and orphaned files
  // are invisible to the app.
  const prefix = `${profile.firm_id}/${jobId}`;
  const { data: files } = await supabase.storage.from("certflow-files").list(prefix, { limit: 1000 });
  if (files?.length) {
    await supabase.storage.from("certflow-files").remove(files.map((f) => `${prefix}/${f.name}`));
  }

  const { error } = await supabase.from("jobs").delete().eq("id", jobId).eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };

  revalidatePath("/jobs");
  revalidatePath("/jobs/deleted");
  revalidatePath("/dashboard");
  redirect("/jobs/deleted");
}

export async function markJobComplete(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  await supabase.from("jobs").update({ status: "complete" }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function reopenJob(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  await supabase.from("jobs").update({ status: "active" }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function assignJobClient(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const clientId = String(formData.get("client_id") || "") || null;
  await supabase.from("jobs").update({ client_id: clientId }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

// Lets the certifier create a brand-new client contact and grant them
// shared access to this job in one step, instead of having to go to
// Settings -> Clients first and then come back here to share access.
export async function addClientAndShare(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name is required." };

  const { data: newClient, error } = await supabase
    .from("clients")
    .insert({
      firm_id: profile.firm_id,
      name,
      type: String(formData.get("type") || "Other"),
      company: String(formData.get("company") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
    })
    .select("id")
    .single();
  if (error || !newClient) return { error: error?.message || "Could not add client." };

  await supabase.from("job_shared_access").insert({ job_id: jobId, client_id: newClient.id });
  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

// Portal contacts change their phone or email mid-project often enough
// that having to leave the job, edit them under Settings -> Clients and
// come back was a real nuisance — this edits the same client record from
// the job's own portal-access panel.
export async function updateClientContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const clientId = String(formData.get("client_id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name is required." };

  const { error } = await supabase
    .from("clients")
    .update({
      name,
      type: String(formData.get("type") || "Other"),
      company: String(formData.get("company") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
    })
    .eq("id", clientId)
    .eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

export async function addSharedAccess(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const clientId = String(formData.get("client_id") || "");
  if (!clientId) return;
  await supabase.from("job_shared_access").insert({ job_id: jobId, client_id: clientId });
  revalidatePath(`/jobs/${jobId}`);
}

export async function removeSharedAccess(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const clientId = String(formData.get("client_id"));
  await supabase.from("job_shared_access").delete().eq("job_id", jobId).eq("client_id", clientId);
  revalidatePath(`/jobs/${jobId}`);
}


async function getCriticalStageInspections(supabase: SupabaseClient, jobId: string): Promise<CriticalStageInspection[]> {
  const { data: job } = await supabase.from("jobs").select("critical_stage_inspections").eq("id", jobId).single();
  return normalizeCriticalStageInspections(job?.critical_stage_inspections);
}

export async function toggleCriticalStageInspection(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const id = String(formData.get("id"));
  const current = await getCriticalStageInspections(supabase, jobId);
  const next = current.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i));
  await supabase.from("jobs").update({ critical_stage_inspections: next }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
}

export async function updateCriticalStageInspection(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage") || "").trim();
  const inspector = String(formData.get("inspector") || "").trim();
  if (!stage) return;
  // Editing an inspection's wording is only ever done because it applies
  // to this job, so it's accepted at the same time — the certifier doesn't
  // have to go back and tick the box as a separate step.
  const current = await getCriticalStageInspections(supabase, jobId);
  const next = current.map((i) => (i.id === id ? { ...i, stage, inspector, enabled: true } : i));
  await supabase.from("jobs").update({ critical_stage_inspections: next }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
}

export async function addCriticalStageInspection(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const stage = String(formData.get("stage") || "").trim();
  const inspector = String(formData.get("inspector") || "").trim();
  if (!stage) return;
  const current = await getCriticalStageInspections(supabase, jobId);
  const next = [...current, { id: crypto.randomUUID(), stage, inspector, enabled: true }];
  await supabase.from("jobs").update({ critical_stage_inspections: next }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
}

export async function removeCriticalStageInspection(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const id = String(formData.get("id"));
  const current = await getCriticalStageInspections(supabase, jobId);
  const next = current.filter((i) => i.id !== id);
  await supabase.from("jobs").update({ critical_stage_inspections: next }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
}

// The certifier's own wording for the covering letters in the approval
// package. Stored per job as the whole letter body, blank paragraphs
// separating paragraphs; clearing it returns the letter to the standard
// wording. Every surface — on-screen, the PDF approved set and the Word
// export — reads the same override through pathwayData.
export async function updateLetterBody(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const field = String(formData.get("letter")) === "applicant" ? "applicant_letter_override" : "council_letter_override";
  const text = String(formData.get("text") || "").trim();
  await supabase
    .from("jobs")
    .update({ [field]: text || null })
    .eq("id", jobId)
    .eq("firm_id", profile.firm_id);
  revalidatePath(`/certificate/pathway/${jobId}`);
  revalidatePath(`/jobs/${jobId}`);
}
