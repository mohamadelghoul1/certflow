"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordReviewEvent } from "@/lib/reviewDigest";
import { pruneSupersededVersions } from "@/lib/documentPruning";
import { requireJobWriter, requireDirector } from "@/lib/auth";
import type { IssueStage } from "@/lib/issueApprovals";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PRIOR_APPROVAL_DOCUMENTS, INSPECTION_LIBRARY, defaultCriticalStageInspections, normalizeCriticalStageInspections, epiForCodeParts } from "@/lib/constants";
import { todayISO, formatISODate, normalizePortalRef, portalRefKindFor, resolveOcCertRef, resolvePathwayCertRef, type PortalRefKind, type Pathway } from "@/lib/business";
import { splitAddress } from "@/lib/address";
import { notifyJobClient } from "@/lib/email";
import { certificateIssuedEmail } from "@/lib/certificateIssuedEmail";
import { backUpIssuedJob } from "@/lib/backup/autoBackup";
import { outstandingSections, outstandingCount, reminderEmailHtml } from "@/lib/documentReminders";
import type { ActionState } from "@/lib/actions/auth";
import { missingJobFields, missingFieldsMessage } from "@/lib/validation/job";
import { insertChecklistItems, reorderedIds } from "@/lib/checklists";
import { detailsPatchFromForm } from "@/lib/jobDetails";
import { mergeJobDetailsInDb } from "@/lib/actions/mergeDetails";
import { notificationEndDate } from "@/lib/neighbourNotification";
import { recordAuditEvent } from "@/lib/audit";
import { isUnknownColumn } from "@/lib/softDelete";
import type { JobDetails, CriticalStageInspection } from "@/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml } from "@/lib/html";
import { removeFolder } from "@/lib/storage";

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
  // Where the applicant's or the owner's address is the site's, it is
  // worked out from the property address rather than typed again — and
  // worked out afresh on every save, so correcting the site address
  // corrects each of them with it.
  const applicantSameAsSite = formData.get("applicantSameAsSite") === "on";
  const ownerAddressSameAsSite = formData.get("ownerAddressSameAsSite") === "on";
  const fromSite = applicantSameAsSite || ownerAddressSameAsSite ? splitAddress(String(formData.get("address") || "")) : null;
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
    applicantSameAsSite,
    applicantAddress: (applicantSameAsSite && fromSite) || {
      streetNumber: String(formData.get("applicantAddress_streetNumber") || ""),
      street: String(formData.get("applicantAddress_street") || ""),
      suburb: String(formData.get("applicantAddress_suburb") || ""),
      state: String(formData.get("applicantAddress_state") || "NSW"),
      postcode: String(formData.get("applicantAddress_postcode") || ""),
    },
    ownerSameAsApplicant: formData.get("ownerSameAsApplicant") === "on",
    ownerAddressSameAsSite,
    owner: {
      name: String(formData.get("owner_name") || ""),
      phone: String(formData.get("owner_phone") || ""),
      address: (ownerAddressSameAsSite && fromSite) || {
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
    // A PC/OC form shows none of the construction detail, so its save
    // must not mention those fields either — the merge leaves what a
    // job already holds (a BCS import's cost, say) exactly as recorded.
    proposal: {
      classifications: formData.getAll("classifications").map(String),
      ...(pathway === "PC_OC"
        ? {}
        : {
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
          }),
    },
    ...(pathway === "PC_OC" ? {} : { siteArea: numericText(formData.get("siteArea")) }),
    inspectionPortalCase: String(formData.get("inspectionPortalCase") || "").trim(),
    // The builder in full; the one-line field is derived from it so every
    // screen and register that predates the structure keeps reading true.
    contractor: {
      company: String(formData.get("contractor_company") || "").trim(),
      name: String(formData.get("contractor_name") || "").trim(),
      phone: String(formData.get("contractor_phone") || "").trim(),
      email: String(formData.get("contractor_email") || "").trim(),
      licenceNo: String(formData.get("contractor_licenceNo") || "").trim(),
    },
    principalContractor:
      String(formData.get("contractor_company") || "").trim() ||
      String(formData.get("contractor_name") || "").trim() ||
      String(formData.get("principalContractor") || "").trim(),
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
  const { profile } = await requireDirector();
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
  await saveContractorToDirectory(supabase, profile.firm_id, formData);

  redirect(`/jobs/${job.id}`);
}

// Puts a ticked builder on the firm's list (migration 0037). Matched by
// licence number when one is given, else by company and name, so saving
// the same builder twice updates their card instead of doubling it. A
// database without the table simply keeps no list — the job itself has
// already recorded the details either way.
async function saveContractorToDirectory(supabase: SupabaseClient, firmId: string, formData: FormData) {
  if (formData.get("contractor_save") !== "on") return;
  const card = {
    company: String(formData.get("contractor_company") || "").trim(),
    name: String(formData.get("contractor_name") || "").trim(),
    phone: String(formData.get("contractor_phone") || "").trim(),
    email: String(formData.get("contractor_email") || "").trim(),
    licence_no: String(formData.get("contractor_licenceNo") || "").trim(),
  };
  if (!card.company && !card.name) return;

  const { data: existing, error } = await supabase.from("contractors").select("id, company, name, licence_no").eq("firm_id", firmId);
  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") console.error("builders list could not be read:", error.message);
    return;
  }
  const match = (existing || []).find((c) =>
    card.licence_no && c.licence_no
      ? c.licence_no.toLowerCase() === card.licence_no.toLowerCase()
      : c.company.toLowerCase() === card.company.toLowerCase() && c.name.toLowerCase() === card.name.toLowerCase()
  );
  const write = match
    ? supabase.from("contractors").update(card).eq("id", match.id)
    : supabase.from("contractors").insert({ ...card, firm_id: firmId });
  const { error: writeError } = await write;
  if (writeError) console.error("builder could not be saved to the list:", writeError.message);
}

export async function updateJobDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireJobWriter();
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
  // Only written when the form carried the field — an older tab or a
  // caller without the dropdown must not silently unassign anyone.
  const assignedCertifierId = formData.has("assigned_certifier_id")
    ? String(formData.get("assigned_certifier_id") || "") || null
    : undefined;
  const address = String(formData.get("address") || "");
  const description = String(formData.get("description") || "");

  await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, patch);
  await saveContractorToDirectory(supabase, profile.firm_id, formData);
  await supabase
    .from("jobs")
    .update({
      address,
      description,
      ...(criticalStageInspections ? { critical_stage_inspections: criticalStageInspections } : {}),
      ...(clientId !== undefined ? { client_id: clientId } : {}),
      ...(assignedCertifierId !== undefined ? { assigned_certifier_id: assignedCertifierId } : {}),
    })
    .eq("id", jobId)
    .eq("firm_id", profile.firm_id);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
  revalidatePath("/certificate/oc/[jobId]/[ocId]", "page");
  revalidatePath("/jobs/[jobId]/inspections/[inspectionId]/report", "page");
  return { savedAt: Date.now() };
}

export async function removeChecklistItem(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  // The row is already hidden on the certifier's screen — a delete that
  // failed must say so, or the item quietly returns on the next visit.
  const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addChecklistItems(formData: FormData) {
  const { profile } = await requireJobWriter();
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
  await requireJobWriter();
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
  await requireJobWriter();
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const value = formData.get("value") === "true";

  const { error } = await supabase.from("checklist_items").update({ include_in_approval: value }).eq("id", itemId);
  if (error) console.error("could not change whether the document is in the approval:", error.message);
  revalidatePath(`/jobs/${jobId}`);
}

// Whether an item is the firm's own business or the client's. An
// internal item never appears in the portal, never carries a reminder,
// and never holds up a booking — the client cannot act on something they
// cannot see.
export async function toggleItemInternal(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const internal = String(formData.get("value")) === "true";

  const { error } = await supabase.from("checklist_items").update({ internal, updated_at: new Date().toISOString() }).eq("id", itemId);
  // A database still to have migration 0051 run has no such column; the
  // item simply stays as it was rather than the press appearing to work.
  if (error && isUnknownColumn(error)) return;
  revalidatePath(`/jobs/${jobId}`);
}

// Whether this checklist item is the caller's to act on, and whether it
// really belongs to the job named alongside it.
//
// Both ids arrive from the browser and can name any row in the database.
// The work that follows in these two actions runs with the service role,
// which row security does not constrain — so the caller's own session is
// asked first. Row security answers "is this item yours"; comparing the
// item's own job to the one posted answers "and is this the job you said
// it was", so one firm's item cannot be filed against another's job.
async function itemBelongsToJob(supabase: Awaited<ReturnType<typeof createClient>>, itemId: string, jobId: string): Promise<boolean> {
  const { data } = await supabase.from("checklist_items").select("id, checklists(job_id)").eq("id", itemId).maybeSingle();
  if (!data) return false;
  const related = (data as { checklists?: { job_id?: string } | { job_id?: string }[] | null }).checklists;
  const ownJobId = Array.isArray(related) ? related[0]?.job_id : related?.job_id;
  return !!ownJobId && ownJobId === jobId;
}

export async function approveItem(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  if (!(await itemBelongsToJob(supabase, itemId, jobId))) return;
  await supabase.from("checklist_items").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", itemId);
  // The client hears automatically, but batched — approvals come in
  // runs, so the first of a burst emails at once and the rest ride
  // along in one summary (lib/reviewDigest.ts). Runs after the response
  // so approving stays instant on screen.
  after(async () => {
    try {
      await recordReviewEvent(createAdminClient(), { jobId, itemId, kind: "approved", note: null });
    } catch (err) {
      console.error("review notification failed", err);
    }
    // The Notice of Commencement issues no certificate of its own, so
    // the moment its last item is approved is the point the stage is
    // finished — the same point that opens the OC stage to the client.
    await pruneNocIfComplete(jobId, itemId);
  });
  revalidatePath(`/jobs/${jobId}`);
}

// A document uploaded on the client's behalf. Without a document number
// this replaces the item's first document; with one it replaces that
// document; "new" adds another alongside — an item satisfied by two
// certificates rather than one.
export async function certifierUploadItem(formData: FormData) {
  const { userId } = await requireJobWriter();
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
  await requireJobWriter();
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
  // No revalidatePath on purpose: nothing else on the page renders these
  // per-document fields, and re-streaming the whole job for every blurred
  // box is what made filling five of them in a row feel like wading.
  void jobId;
}

// Drops one document from an item, with every version of it. The item
// keeps the rest; removing the last one leaves the item awaiting a
// document again, which is what it is.
export async function removeItemDocument(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const documentNo = Number(formData.get("document_no")) || 1;

  // .select() so a delete that touched no rows is caught — row security
  // without a delete policy removes nothing and raises nothing, which is
  // how this button did nothing for weeks without anyone knowing.
  const { data: deleted, error } = await supabase.from("checklist_item_files").delete().eq("checklist_item_id", itemId).eq("document_no", documentNo).select("id");
  if (error) throw new Error(error.message);
  if (!deleted || deleted.length === 0) throw new Error("The document could not be removed. If this keeps happening, migration 0042 hasn't been run.");

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

// Deletes one superseded version of a document — the certifier tidying
// history after a corrected copy arrived, keeping only the one that
// counts. The current version is protected: removing it is what
// "Remove this document" does, moving the item's pointer with it.
export async function removeItemDocumentVersion(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const fileId = String(formData.get("file_id"));
  const jobId = String(formData.get("job_id"));

  const { data: row } = await supabase.from("checklist_item_files").select("is_current").eq("id", fileId).single();
  if (!row || row.is_current) return;
  const { data: deleted, error } = await supabase.from("checklist_item_files").delete().eq("id", fileId).select("id");
  if (error) throw new Error(error.message);
  if (!deleted || deleted.length === 0) throw new Error("The version could not be deleted. If this keeps happening, migration 0042 hasn't been run.");
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateItemDetails(formData: FormData) {
  await requireJobWriter();
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
  await requireJobWriter();
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
  const { profile } = await requireJobWriter();
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
  await requireJobWriter();
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("checklist_items").update({ stamp_x: null, stamp_y: null, stamp_scale: null }).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleStamping(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const value = formData.get("value") === "true";
  await supabase.from("checklist_items").update({ requires_stamping: value }).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addAmendment(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  if (!(await itemBelongsToJob(supabase, itemId, jobId))) return;
  await supabase.from("amendments").insert({ checklist_item_id: itemId, text });
  // Batched the same way as approvals — see the note in approveItem.
  after(async () => {
    try {
      await recordReviewEvent(createAdminClient(), { jobId, itemId, kind: "changes", note: text });
    } catch (err) {
      console.error("review notification failed", err);
    }
  });
  revalidatePath(`/jobs/${jobId}`);
}

// What the "Notify client" buttons show after being pressed — the email
// went, or the reason it didn't.
export type NotifyState = { success?: string; error?: string } | undefined;

// Manual, batched notification — one summary email per click, instead of
// one email per approval/amendment. Mirrors the prototype's
// buildJobUpdateMailto: "X of Y documents approved — Z items need your
// attention", not a blow-by-blow log.
export async function notifyClientOfChecklist(_prev: NotifyState, formData: FormData): Promise<NotifyState> {
  await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const checklistId = String(formData.get("checklist_id"));
  const label = String(formData.get("label") || "your project");

  const [{ data: items }, { data: job }] = await Promise.all([
    supabase.from("checklist_items").select("status, amendments(resolved)").eq("checklist_id", checklistId),
    supabase.from("jobs").select("address").eq("id", jobId).single(),
  ]);

  const total = items?.length || 0;
  const approved = (items || []).filter((i) => i.status === "approved").length;
  const openAmendments = (items || []).reduce((sum, i) => sum + (i.amendments || []).filter((a: { resolved: boolean }) => !a.resolved).length, 0);
  const outstanding = total - approved;

  let statusLine = total > 0 ? `${approved} of ${total} documents approved` : "No documents requested yet";
  if (openAmendments > 0) statusLine += ` — ${openAmendments} item${openAmendments === 1 ? "" : "s"} require your attention`;

  // The address carries the subject line: a client with three projects
  // running should be able to tell which one an update is about without
  // opening it.
  const address = job?.address || "";
  const site = address ? ` — ${escapeHtml(address)}` : "";
  const forSite = address ? ` for <strong>${escapeHtml(address)}</strong>` : "";

  // What to do next, which depends on what is actually outstanding: a
  // request to upload documents reads badly when nothing is owed.
  const nextStep =
    openAmendments > 0
      ? `<p>Please review the items marked as requiring changes in your portal — the details are noted against each document — and upload the revised documents at your earliest convenience.</p>`
      : outstanding > 0
        ? `<p>Please upload the outstanding documents through your client portal at your earliest convenience so that we can continue the assessment of your application.</p>`
        : `<p>No further documents are required from you at this stage. We will be in touch as the assessment progresses.</p>`;

  const outcome = await notifyJobClient(
    supabase,
    jobId,
    `${label} checklist update${site}`,
    [
      `<p>Here&rsquo;s the current status of the <strong>${escapeHtml(label)}</strong> checklist${forSite}:</p>`,
      `<p style="padding:12px;background:#f0fdfa;border-radius:6px">${statusLine}</p>`,
      nextStep,
    ].join("")
  );
  if (!outcome.sent) return { error: outcome.reason || "The email could not be sent." };

  await supabase.from("jobs").update({ last_notified_at: new Date().toISOString() }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
  return { success: "Status update emailed to the client." };
}

// The same reminder the morning sweep sends, on demand — for the phone
// call that ends with "I'll email you the list now". Uses the identical
// wording and rules, so what the button sends is exactly what the
// automatic one would have.
export type ReminderActionState = { error?: string; success?: string } | undefined;

export async function sendDocumentReminderNow(_prev: ReminderActionState, formData: FormData): Promise<ReminderActionState> {
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));

  const { data: job } = await supabase
    .from("jobs")
    .select("id, firm_id, address, pathway, client_id, checklists(kind, checklist_items(title, status, amendments(resolved)))")
    .eq("id", jobId)
    .eq("firm_id", profile.firm_id)
    .single();
  if (!job) return { error: "Project not found." };
  if (!job.client_id) return { error: "This project has no client to remind — add one on the Details tab first." };

  const sections = outstandingSections((job.checklists as never[]) || [], job.pathway as Pathway);
  if (sections.length === 0) return { error: "Nothing is outstanding — the client has sent everything that was asked for." };

  const count = outstandingCount(sections);
  await notifyJobClient(supabase, jobId, `Documents outstanding — ${job.address}`, reminderEmailHtml(sections));
  await supabase.from("jobs").update({ last_document_reminder_at: new Date().toISOString() }).eq("id", jobId);
  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "client.reminder",
    summary: `Reminded the client: ${count} document${count === 1 ? "" : "s"} outstanding`,
    jobId,
    jobAddress: job.address,
    actor: profile,
    detail: { outstanding: count, manual: true },
  });
  revalidatePath(`/jobs/${jobId}`);
  return { success: `Reminder sent — ${count} outstanding document${count === 1 ? "" : "s"} listed.` };
}

// Some clients shouldn't be chased — a job on hold, a builder who has
// asked to deal by phone. Pausing is per project and reversible.
export async function toggleDocumentReminders(formData: FormData) {
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const paused = String(formData.get("paused")) === "true";
  await supabase.from("jobs").update({ document_reminders_paused: paused }).eq("id", jobId).eq("firm_id", profile.firm_id);
  revalidatePath(`/jobs/${jobId}`);
}

// Generic one-off milestone notification — used by the manual "Notify
// client" buttons next to a certificate/report once it's ready, instead
// of firing automatically the moment it's uploaded/marked sent.
export async function notifyClientMessage(_prev: NotifyState, formData: FormData): Promise<NotifyState> {
  await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const subject = String(formData.get("subject") || "Update on your project");
  const message = String(formData.get("message") || "");

  const outcome = await notifyJobClient(supabase, jobId, subject, `<p>${message}</p>`);
  if (!outcome.sent) return { error: outcome.reason || "The email could not be sent." };

  await supabase.from("jobs").update({ last_notified_at: new Date().toISOString() }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
  return { success: "Email sent to the client." };
}

export async function resolveAmendment(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const amendmentId = String(formData.get("amendment_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("amendments").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", amendmentId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function removeAmendment(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const amendmentId = String(formData.get("amendment_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("amendments").delete().eq("id", amendmentId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addCondition(formData: FormData) {
  const { profile } = await requireJobWriter();
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
  await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const conditionId = String(formData.get("condition_id"));
  await supabase.from("conditions_of_consent").delete().eq("id", conditionId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
}

export async function reopenItem(formData: FormData) {
  await requireJobWriter();
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
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));

  // Trimmed, de-duplicated and emptied of blanks, so a stray comma or a
  // double-tick doesn't put the same constraint on the job twice.
  const sensitivities = [...new Set(formData.getAll("sensitivity").map((v) => String(v).trim()).filter(Boolean))];

  await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { siteSensitivities: sensitivities });
  revalidatePath(`/jobs/${jobId}`);
}

export async function setPlanningPortalRef(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const kind = (String(formData.get("kind") || "CDC") as PortalRefKind);
  const ref = normalizePortalRef(String(formData.get("planningPortalRef") || ""), kind);
  if (!ref) return { error: "Enter the Planning Portal reference number." };

  // A modification is its own Portal application, so its reference lives
  // on the modification rather than the job — the original certificate
  // keeps its own. Row security scopes the update to this firm's rows.
  const modificationId = String(formData.get("modification_id") || "");
  if (modificationId) {
    const { error } = await supabase.from("modifications").update({ portal_ref: ref }).eq("id", modificationId).eq("job_id", jobId);
    if (error) return { error: error.message.includes("portal_ref") ? "Run database update 0065 first — see Settings → System check." : error.message };
  } else {
    await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { certificateDetails: { planningPortalRef: ref } });
  }
  revalidatePath(`/jobs/${jobId}`);
  return { savedAt: Date.now() };
}

// The two dates the pre-inspection report needs that the job doesn't
// already know: when the application was made, and when the inspection
// was carried out. Entered where the certificate is issued, for the same
// reason the Planning Portal reference is — going back to the Details tab
// for two fields at the moment of issuing is how a report goes out blank.
export async function setPreInspectionDates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const applicationDate = String(formData.get("applicationDate") || "");
  const inspectionDate = String(formData.get("inspectionDate") || "");

  // A modification's pre-inspection is its own — dates on the
  // modification row, so the original certificate's report keeps its own
  // dates untouched.
  const modificationId = String(formData.get("modification_id") || "");
  if (modificationId) {
    const { error } = await supabase
      .from("modifications")
      .update({ pre_application_date: applicationDate || null, pre_inspection_date: inspectionDate || null })
      .eq("id", modificationId)
      .eq("job_id", jobId);
    if (error) return { error: error.message.includes("pre_") ? "Run database update 0065 first — see Settings → System check." : error.message };
  } else {
    await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { preInspection: { applicationDate, inspectionDate } });
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pre-inspection/${jobId}`);
  return { savedAt: Date.now() };
}

// The neighbour notification's 17 days. The end date is worked out from
// the start by lib/neighbourNotification — including the Friday rule —
// unless the certifier types their own.
export async function setNeighbourNotificationDates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const start = String(formData.get("start") || "").trim();
  const typedEnd = String(formData.get("end") || "").trim();
  const end = typedEnd || (start ? notificationEndDate(start) || "" : "");
  await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { neighbourNotification: { start: start || null, end: end || null } });
  revalidatePath(`/jobs/${jobId}`);
  return { savedAt: Date.now() };
}

// A team member issues only where a director has said yes. The database
// refuses it too (migration 0074) and spends the approval in the same
// statement that creates the certificate — this is so the answer reads
// as a sentence rather than as a database error.
async function awaitingDirector(supabase: SupabaseClient, jobId: string, stage: IssueStage, director: boolean): Promise<boolean> {
  if (director) return false;
  const { data, error } = await supabase.rpc("issue_approval_open", { p_job_id: jobId, p_stage: stage });
  // No such function means migration 0074 has not been run, and nothing
  // is being asked of anyone yet.
  if (error) return false;
  return !data;
}

const NEEDS_APPROVAL = "A director has to approve this before you can issue it — use Request director approval above.";

export async function issuePathwayCertificate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile, director } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const certifierId = String(formData.get("certifier_id") || "");
  if (!certifierId) return { error: "Select a certifier before issuing." };

  const { data: job } = await supabase.from("jobs").select("id, details").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "Project not found." };
  if (await awaitingDirector(supabase, jobId, "pathway", director)) return { error: NEEDS_APPROVAL };

  // The certificate carries the NSW Planning Portal reference, so it
  // cannot be issued without one. Checked here as well as in the form —
  // a disabled button is a courtesy, not a control.
  const jobDetails = (job.details || {}) as JobDetails;
  if (!jobDetails.certificateDetails?.planningPortalRef?.trim()) {
    return { error: "Enter the NSW Planning Portal reference number before issuing." };
  }

  // A recorded neighbour notification is a hold on determination: the
  // certificate cannot be issued until the 17 days are up. The date came
  // from the certifier's own hand, so the way past it is theirs too —
  // clear the dates if notification does not apply to this job.
  const notificationEnd = jobDetails.neighbourNotification?.end;
  if (notificationEnd && notificationEnd >= todayISO()) {
    return {
      error: `The neighbour notification period runs until ${formatISODate(notificationEnd)}, so the certificate cannot be determined yet. If notification does not apply to this project, clear the dates in the Neighbour notification panel below.`,
    };
  }

  const issued = await issueNextPathwayVersion(supabase, jobId, certifierId, profile.firm_id);
  if (issued.error) return { error: issued.error };
  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

// Issues the next certificate version: the new row becomes the active
// version, the job mirrors it, and the date of determination moves to
// today. Shared by the first issue, a regeneration, and issuing a
// modification — a modified certificate is a new version of the same
// certificate, so all three must do exactly the same thing.
async function issueNextPathwayVersion(supabase: SupabaseClient, jobId: string, certifierId: string, firmId: string): Promise<{ error?: string; versionId?: string }> {
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
  await mergeJobDetailsInDb(supabase, jobId, firmId, { certificateDetails: { determinationDate: generatedDate } });

  // The approval is out; the drafts that led to it are dead weight.
  after(() => pruneAfterIssue({ jobId, kind: "pathway", firmId }));
  return { versionId: newVersion.id };
}

async function pruneNocIfComplete(jobId: string, itemId: string) {
  try {
    const admin = createAdminClient();
    const { data: item } = await admin.from("checklist_items").select("checklist_id").eq("id", itemId).single();
    if (!item) return;
    const { data: checklist } = await admin.from("checklists").select("id, kind").eq("id", item.checklist_id).single();
    if (checklist?.kind !== "noc") return;

    const { data: siblings } = await admin.from("checklist_items").select("status").eq("checklist_id", checklist.id);
    if (!siblings || siblings.length === 0 || !siblings.every((i) => i.status === "approved")) return;

    const { data: job } = await admin.from("jobs").select("firm_id, address").eq("id", jobId).single();
    await pruneSupersededVersions(admin, { jobId, kind: "noc", firmId: job?.firm_id ?? null, jobAddress: job?.address ?? null });
  } catch (err) {
    console.error("could not clear superseded versions", err);
  }
}

// Superseded copies go once a stage's certificate is issued — see
// lib/documentPruning. Always after the response: the certifier is
// waiting on the certificate, not on housekeeping, and a failure here
// must never fail the issuing.
async function pruneAfterIssue({ jobId, kind, firmId }: { jobId: string; kind: "pathway" | "noc" | "oc"; firmId: string | null }) {
  try {
    const admin = createAdminClient();
    const { data: job } = await admin.from("jobs").select("address").eq("id", jobId).single();
    await pruneSupersededVersions(admin, { jobId, kind, firmId, jobAddress: job?.address ?? null });
  } catch (err) {
    console.error("could not clear superseded versions", err);
  }
}

// Separate from issuing: generating the certificate package no longer signs
// it automatically, so the certifier can export it to Word to review/amend
// first. Signing just stamps the currently-visible version with who/when —
// it doesn't lock the checklist or letters from further edits.
export async function signPathwayCertificate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireJobWriter();
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
  const { profile } = await requireJobWriter();
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

  // The certificate is not permission to start building — the Notice of
  // Commencement is, and that waits on the client. So the email names
  // what is still outstanding on the NOC checklist rather than leaving
  // "issued" to be read as "go ahead".
  const [{ data: nocChecklist }, { data: firm }] = await Promise.all([
    supabase.from("checklists").select("id, checklist_items(*)").eq("job_id", jobId).eq("kind", "noc").maybeSingle(),
    supabase.from("firms").select("name").eq("id", profile.firm_id).maybeSingle(),
  ]);
  const outstanding = (((nocChecklist?.checklist_items as { title: string; status: string; sort_order: number; internal?: boolean }[] | null) || [])
    .filter((i) => i.status !== "approved" && !i.internal)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.title));

  const { subject, html } = certificateIssuedEmail({
    pathway: job.pathway as Pathway,
    address: job.address,
    firmName: (firm as { name?: string } | null)?.name || null,
    outstanding,
  });
  await notifyJobClient(supabase, jobId, subject, html);

  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "certificate.sent",
    summary: `Released the ${job.pathway} certificate to the client`,
    jobId,
    jobAddress: job.address,
    actor: profile,
    detail: { pathway: job.pathway, version: job.pathway_version },
  });

  // The moment a certificate is released is the moment the job's records
  // are worth keeping. After the response, because a copy to somebody's
  // Dropbox must never hold up issuing a certificate.
  after(async () => {
    await backUpIssuedJob(jobId, profile, "pathway");
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/pathway/${jobId}`);
  return undefined;
}

export async function uploadPathwayApproval(formData: FormData) {
  await requireJobWriter();
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
  const { profile } = await requireJobWriter();
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
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const versionId = String(formData.get("version_id"));

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return;

  // Deleting a modified certificate puts its modification back to draft,
  // so it can be corrected and issued again — the modification's
  // checklist, reason, Portal reference and inspection dates all stay.
  // Scoped to the one version being deleted; on a database that has not
  // run migration 0066 there is no link column, and this is a no-op.
  await supabase
    .from("modifications")
    .update({ generated: false, generated_date: null, issued_by: null, certificate_version_id: null })
    .eq("job_id", jobId)
    .eq("certificate_version_id", versionId);

  const { data: deleted } = await supabase.from("pathway_certificate_versions").delete().eq("id", versionId).select().single();

  if (deleted?.visible_to_client) {
    const { data: remaining } = await supabase.from("pathway_certificate_versions").select("*").eq("job_id", jobId).order("version", { ascending: false }).limit(1);
    const promoted = remaining?.[0] || null;
    if (promoted) await supabase.from("pathway_certificate_versions").update({ visible_to_client: true }).eq("id", promoted.id);
    await mirrorVisiblePathwayVersion(supabase, jobId, promoted);
  }
  revalidatePath(`/jobs/${jobId}`);
}

// Removing an issued Occupation Certificate — a wrong type picked, a
// certificate generated against the wrong details. Refused once it has
// been reported to the NSW Planning Portal, the same line the
// inspections hold: what the regulator has been told exists cannot
// quietly stop existing. Recorded in the audit log either way, because
// an issued certificate disappearing is history, not housekeeping.
export async function deleteOc(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const ocId = String(formData.get("oc_id"));

  const { data: job } = await supabase.from("jobs").select("id, address").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "Project not found." };

  const { data: record } = await supabase.from("oc_records").select("*").eq("id", ocId).eq("job_id", jobId).maybeSingle();
  if (!record) return { error: "Could not find this Occupation Certificate." };
  if (record.portal_reported) {
    return { error: "This Occupation Certificate has been reported to the NSW Planning Portal and can no longer be deleted." };
  }

  const { error } = await supabase.from("oc_records").delete().eq("id", ocId).eq("job_id", jobId);
  if (error) return { error: error.message };

  // The uploaded signed copy goes with it — an orphaned file nobody can
  // reach from the app is clutter at best and a stale certificate at
  // worst. Best effort: the record is already gone either way.
  if (record.approval_file_path) {
    await supabase.storage.from("certflow-files").remove([record.approval_file_path]);
  }

  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "oc.deleted",
    summary: `Deleted the ${record.type === "whole" ? "Whole" : "Partial"} Occupation Certificate${record.cert_ref ? ` ${record.cert_ref}` : ""}`,
    jobId,
    jobAddress: job.address || null,
    actor: profile,
    detail: { type: record.type, certRef: record.cert_ref, generatedDate: record.generated_date, wasSigned: !!record.signed_at, wasSentToClient: !!record.sent_to_client },
    severity: "warning",
  });

  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

// Overrides the auto-generated certificate reference for one version / one
// OC record. Blank clears the override, putting it back on the generated
// {PATHWAY}-{project number}/{version} form.
export async function renameCertRef(formData: FormData) {
  const { profile } = await requireJobWriter();
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
  const { profile } = await requireJobWriter();
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
  await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const reason = String(formData.get("reason") || "");

  // One modification at a time. The panel hides the form while one is
  // under way, but a stale page can still submit — refused here so two
  // half-done modifications cannot exist, each with a checklist claiming
  // to be "the" modification.
  const { data: open } = await supabase.from("modifications").select("id").eq("job_id", jobId).eq("generated", false).limit(1);
  if (open && open.length > 0) {
    revalidatePath(`/jobs/${jobId}`);
    return;
  }

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
  const { profile, director } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const modificationId = String(formData.get("modification_id"));
  const certifierId = String(formData.get("certifier_id") || "");
  if (!certifierId) return { error: "Select a certifier before issuing." };

  // A modification is its own Planning Portal application, and the
  // modified certificate prints its reference — so it is gated on the
  // modification's own number, not the original certificate's.
  const { data: modJob } = await supabase.from("jobs").select("id").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!modJob) return { error: "Project not found." };
  if (await awaitingDirector(supabase, jobId, "pathway", director)) return { error: NEEDS_APPROVAL };
  const { data: modRow } = await supabase.from("modifications").select("portal_ref").eq("id", modificationId).eq("job_id", jobId).single();
  if (!modRow) return { error: "Modification not found." };
  if (!modRow.portal_ref?.trim()) {
    return { error: "Enter this modification's NSW Planning Portal reference before issuing." };
  }

  // Issuing the modification issues the modified certificate in the same
  // press: a new certificate version is created — which is what makes the
  // documents say "Section 4.30 Modification" and carry the /02 number —
  // rather than leaving "Regenerate certificate" as a separate step in
  // another panel that was easy to miss.
  const issued = await issueNextPathwayVersion(supabase, jobId, certifierId, profile.firm_id);
  if (issued.error) return { error: issued.error };

  const { data: mod } = await supabase.from("modifications").select("version").eq("id", modificationId).single();
  const patch = { generated: true, generated_date: todayISO(), issued_by: certifierId, version: (mod?.version || 0) + 1 };
  // The link is what lets the modification's card show — and delete —
  // only the version it produced. A database that has not run migration
  // 0066 has no column for it yet; issuing still goes through, unlinked.
  const { error } = await supabase
    .from("modifications")
    .update({ ...patch, certificate_version_id: issued.versionId })
    .eq("id", modificationId);
  if (error?.message.includes("certificate_version_id")) {
    const { error: retryError } = await supabase.from("modifications").update(patch).eq("id", modificationId);
    if (retryError) return { error: retryError.message };
  } else if (error) {
    return { error: error.message };
  }
  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

export async function uploadModificationApproval(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const modificationId = String(formData.get("modification_id"));
  const filePath = String(formData.get("file_path"));
  await supabase.from("modifications").update({ approval_uploaded: true, approval_date: todayISO(), approval_file_path: filePath }).eq("id", modificationId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function issueOc(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { director } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  if (await awaitingDirector(supabase, jobId, "oc", director)) return { error: NEEDS_APPROVAL };
  const type = String(formData.get("type")) as "partial" | "whole";
  const description = String(formData.get("description") || "");
  const exclusions = String(formData.get("exclusions") || "").trim();
  const certifierId = String(formData.get("certifier_id") || "");
  if (!certifierId) return { error: "Select a certifier before issuing." };

  // Each occupation certificate is its own Portal application, so the
  // reference is recorded against the certificate as it is created rather
  // than taken from the job.
  const portalRef = normalizePortalRef(String(formData.get("portal_ref") || ""), "OC");
  if (!portalRef) return { error: "Enter the NSW Planning Portal reference number before issuing." };

  // The certificate's number is settled now and stamped on the record,
  // so a modification bumping the job's version later cannot quietly
  // renumber a certificate that has already gone out. On a full-service
  // job that number is the CDC/CC the OC completes; on a PC/OC job, a
  // series of this firm's own.
  const [{ data: ocJob }, { data: activeVersion }, { count: priorOcs }] = await Promise.all([
    supabase.from("jobs").select("firm_id, pathway, pathway_version, pathway_generated, details").eq("id", jobId).single(),
    supabase.from("pathway_certificate_versions").select("cert_ref, version").eq("job_id", jobId).order("version", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("oc_records").select("id", { count: "exact", head: true }).eq("job_id", jobId),
  ]);
  if (!ocJob) return { error: "Could not find this job to issue against." };
  const projectRef = (ocJob.details as JobDetails | null)?.projectNumber || jobId.slice(0, 8);
  const governingRef = ocJob.pathway_generated
    ? resolvePathwayCertRef(activeVersion?.cert_ref, ocJob.pathway as Pathway, projectRef, ocJob.pathway_version || 1)
    : "";
  const certRef = resolveOcCertRef(null, ocJob.pathway as Pathway, governingRef, projectRef, (priorOcs || 0) + 1);

  const { error } = await supabase
    .from("oc_records")
    .insert({ job_id: jobId, type, description, exclusions: exclusions || null, cert_ref: certRef, generated_date: todayISO(), issued_by: certifierId, portal_ref: portalRef });
  if (error) {
    // A database from before migration 0067 has no exclusions column;
    // the certificate still issues, without the row, rather than
    // refusing until the migration is run.
    if (!isUnknownColumn(error)) return { error: error.message };
    const retry = await supabase
      .from("oc_records")
      .insert({ job_id: jobId, type, description, cert_ref: certRef, generated_date: todayISO(), issued_by: certifierId, portal_ref: portalRef });
    if (retry.error) return { error: retry.error.message };
  }

  after(() => pruneAfterIssue({ jobId, kind: "oc", firmId: ocJob.firm_id ?? null }));
  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

export async function signOc(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireJobWriter();
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
  const { profile } = await requireJobWriter();
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

  after(async () => {
    await backUpIssuedJob(jobId, profile, "oc");
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/certificate/oc/${jobId}/${ocId}`);
  return undefined;
}

export async function uploadOcApproval(formData: FormData) {
  await requireJobWriter();
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
  const { profile, userId } = await requireDirector();
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
  const { profile } = await requireDirector();
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
  const { profile } = await requireDirector();
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

  // Storage has no recursive delete, and listing one level down a
  // project's folder answers with folders — checklist, inspections,
  // certificates — not the files inside them. Handing those folder paths
  // to remove() deleted nothing and reported no error, so every purged
  // project left its documents behind, invisible to the app and still
  // counting against the storage quota. See lib/storage.
  //
  // Still not fatal if it fails: the project goes either way, and the
  // Storage page offers to clear what is left.
  await removeFolder(supabase, "certflow-files", `${profile.firm_id}/${jobId}`);

  const { error } = await supabase.from("jobs").delete().eq("id", jobId).eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };

  revalidatePath("/jobs");
  revalidatePath("/jobs/deleted");
  revalidatePath("/dashboard");
  redirect("/jobs/deleted");
}

export async function markJobComplete(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  await supabase.from("jobs").update({ status: "complete" }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function reopenJob(formData: FormData) {
  await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  await supabase.from("jobs").update({ status: "active" }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function assignJobClient(formData: FormData) {
  await requireJobWriter();
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
  const { profile } = await requireJobWriter();
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
  const { profile } = await requireJobWriter();
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
  await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const clientId = String(formData.get("client_id") || "");
  if (!clientId) return;
  await supabase.from("job_shared_access").insert({ job_id: jobId, client_id: clientId });
  revalidatePath(`/jobs/${jobId}`);
}

export async function removeSharedAccess(formData: FormData) {
  await requireJobWriter();
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
  await requireJobWriter();
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
  await requireJobWriter();
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
  await requireJobWriter();
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
  await requireJobWriter();
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
// One block of wording on a generated document. Kept in the job's own
// details under docOverrides, keyed by the block, so a new editable
// block on a letter or a certificate needs no schema change. An empty
// value clears the override and the standard wording returns.
export async function updateDocText(formData: FormData) {
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const key = String(formData.get("key") || "").trim();
  const text = String(formData.get("text") || "").trim();
  if (!key) return;

  await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { docOverrides: { [key]: text } } as JobDetails);
  revalidatePath(`/certificate/pathway/${jobId}`);
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateLetterBody(formData: FormData) {
  const { profile } = await requireJobWriter();
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
