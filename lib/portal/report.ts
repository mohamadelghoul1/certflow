import type { SupabaseClient } from "@supabase/supabase-js";
import { portalConfig } from "@/lib/portal/config";
import { callPortal, extractChildCaseId } from "@/lib/portal/client";
import { initiateInspectionBody, performInspectionBody, completeInspectionBody, portalDocument, PORTAL_DOC_TYPES, type PortalDocument } from "@/lib/portal/inspections";
import { recordAuditEvent } from "@/lib/audit";
import { buildInspectionSummaryImage } from "@/lib/portal/summaryImage";
import { eplanningDocumentUrl } from "@/lib/portal/files";
import { INSPECTION_OUTCOME_TEXT } from "@/lib/constants";
import { formatISODate } from "@/lib/business";
import type { Profile } from "@/types/db";

// Reporting one Certlyn inspection to the NSW Planning Portal.
//
// Three calls, in the order the department's workflow runs them: open
// the inspection case against the Portal case, record the visit with
// the signed report attached as a link, close the inspection out. Every
// call and every answer is written to the audit log verbatim — a
// government submission is exactly the kind of thing that has to be
// reconstructable afterwards, most of all when it fails.

export type PortalSendOutcome = { ok: true; childCaseId: string } | { ok: false; error: string };

// The declaration wordings are the specification's own fixed sentences,
// not editable prose.
const DECLARATION = "I confirm that I have inspected the site subject of this application";
const CC_RESULT_DECLARATION =
  "I confirm that I have inspected the site subject of this application and existing works on the site are appropriately reflected in the construction certificate plans.";

export async function sendInspectionToPortal(
  supabase: SupabaseClient,
  profile: Profile,
  input: {
    caseId: string;
    jobId: string;
    jobAddress: string | null;
    inspection: { id: string; title: string; date: string | null; outcome: string; report_pdf_path?: string | null };
    firmName: string;
    inspectorName: string;
    registrationNumber: string;
    // The Portal requires the email of the registered Portal user making
    // the submission — it rejected the call outright without it.
    updatedByEmail: string;
    // An inspection case the Portal has already opened — from an earlier
    // attempt that created it but could not read its number back. When
    // set, the opening call is skipped and the visit is recorded straight
    // onto that case, so nothing is duplicated.
    existingChildCaseId?: string | null;
  }
): Promise<PortalSendOutcome> {
  const config = portalConfig();
  if (!config) return { ok: false, error: "The Planning Portal connection is not set up yet — see Settings → System check." };

  const { caseId, jobId, jobAddress, inspection, firmName, inspectorName, registrationNumber, updatedByEmail, existingChildCaseId } = input;

  if (!inspection.date) return { ok: false, error: "The inspection has no date recorded." };
  if (!inspection.outcome || inspection.outcome === "pending") return { ok: false, error: "Record the inspection outcome before reporting it." };

  const log = (step: string, ok: boolean, detail: Record<string, unknown>) =>
    recordAuditEvent(supabase, {
      firmId: profile.firm_id,
      action: "portal.inspection",
      summary: `${ok ? "Sent" : "Could not send"} ${step} for the ${inspection.title} inspection to the Planning Portal`,
      jobId,
      jobAddress,
      actor: profile,
      detail: { step, portalCaseId: caseId, ...detail },
      severity: ok ? "info" : "error",
    });

  // Documents are announced at Certlyn's registered inbound endpoint —
  // ePlanning's gateway only downloads from the inbound URL lodged at
  // registration, using the department's Get External Document contract,
  // and refuses any other link without even fetching it.
  const reportDocuments: PortalDocument[] = [];
  if (inspection.report_pdf_path) {
    reportDocuments.push(portalDocument("inspection-report.pdf", eplanningDocumentUrl(inspection.report_pdf_path), PORTAL_DOC_TYPES.report));
  }
  if (reportDocuments.length === 0) {
    return { ok: false, error: "The signed inspection report could not be attached. Sign the report first — the Portal requires the document." };
  }

  // The Portal refuses a visit record without at least one image.
  // Deliberately, the firm's site photographs are never sent — they are
  // its own working records — and the government record always gets the
  // same generated card: what the inspection was, how it ended, and
  // where the full record lives.
  const recordImages: PortalDocument[] = [];
  const image = await buildInspectionSummaryImage({
    firmName,
    address: jobAddress || "",
    inspectionTitle: inspection.title,
    date: formatISODate(inspection.date),
    outcomeText: INSPECTION_OUTCOME_TEXT[inspection.outcome] || inspection.outcome,
    inspectorName,
  });
  const imagePath = `${profile.firm_id}/${jobId}/inspections/${inspection.id}/portal-summary-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage.from("certflow-files").upload(imagePath, image, { contentType: "image/jpeg", upsert: false });
  if (!uploadError) {
    recordImages.push(portalDocument("inspection-record.jpg", eplanningDocumentUrl(imagePath), PORTAL_DOC_TYPES.photos));
  }
  if (recordImages.length === 0) {
    return { ok: false, error: "The Portal requires an image on the inspection record and one could not be prepared. Try again, and tell your developer if it repeats." };
  }

  // 1. Open the inspection case — unless the Portal already holds one
  // from an earlier attempt, in which case the visit is recorded onto it.
  let childCaseId: string;
  if (existingChildCaseId) {
    childCaseId = existingChildCaseId;
    await log("InitiateInspection", true, { note: "resuming an inspection case the Portal already opened", childCaseId });
  } else {
    const initiate = await callPortal(config, "POST", `/InitiateInspection/${encodeURIComponent(caseId)}`, initiateInspectionBody({
      certlynTitle: inspection.title,
      scheduledDate: inspection.date,
      registrationNumber,
      updatedByEmail,
    }));
    await log("InitiateInspection", initiate.ok, { status: initiate.status, response: initiate.body.slice(0, 2000), responseHeaders: initiate.headers });
    if (!initiate.ok) return { ok: false, error: portalErrorMessage("open the inspection case", initiate.status, initiate.body) };

    const extracted = extractChildCaseId(initiate.body, initiate.headers);
    if (extracted) {
      // Remembered the moment the Portal issues it, before anything else
      // can fail: a retry then resumes this case automatically instead of
      // opening a second one. A database without migration 0030 simply
      // skips the note.
      await supabase.from("inspections").update({ portal_child_case_id: extracted }).eq("id", inspection.id);
    }
    if (!extracted) {
      await log("InitiateInspection", false, { status: initiate.status, response: initiate.body.slice(0, 2000), responseHeaders: initiate.headers, reason: "no inspection case id in the response" });
      return {
        ok: false,
        error: `The Portal opened the inspection but its answer did not carry the new case number, so the visit was not recorded onto it. Find the inspection case's number on the Portal and enter it under "already opened" in this panel — do not press Send again without it, or a second case will be opened. The Portal said: ${initiate.body.slice(0, 250) || "(empty response)"}`,
      };
    }
    childCaseId = extracted;
  }

  // 2. Record the visit.
  const perform = await callPortal(config, "PUT", `/PerformInspection/${encodeURIComponent(caseId)}`, performInspectionBody({
    childCaseID: childCaseId,
    certlynTitle: inspection.title,
    inspectionDate: inspection.date,
    outcome: inspection.outcome,
    inspectorName,
    documents: recordImages,
    updatedByEmail,
  }));
  await log("PerformInspection", perform.ok, { childCaseId, status: perform.status, response: perform.body.slice(0, 2000) });
  if (!perform.ok) return { ok: false, error: portalErrorMessage("record the inspection", perform.status, perform.body) };

  // 3. Close it out.
  const complete = await callPortal(config, "PUT", `/CompleteInspection/${encodeURIComponent(caseId)}`, completeInspectionBody({
    childCaseID: childCaseId,
    furtherInspectionRequired: inspection.outcome !== "passed",
    declarations: DECLARATION,
    inspectionResultDeclaration: CC_RESULT_DECLARATION,
    documents: reportDocuments,
    updatedByEmail,
  }));
  await log("CompleteInspection", complete.ok, { childCaseId, status: complete.status, response: complete.body.slice(0, 2000) });
  if (!complete.ok) return { ok: false, error: portalErrorMessage("complete the inspection", complete.status, complete.body) };

  return { ok: true, childCaseId };
}

// The Portal's errors come back as JSON with a message worth showing;
// anything else gets the status code and the start of whatever was said.
function portalErrorMessage(doing: string, status: number, body: string): string {
  let said = "";
  try {
    const parsed = JSON.parse(body);
    said = parsed?.message || parsed?.description || parsed?.error || "";
  } catch {
    said = body;
  }
  said = String(said).slice(0, 300);
  if (status === 0) return `Could not reach the Planning Portal to ${doing}: ${said}`;
  if (status === 401 || status === 403) return `The Portal refused the API key while trying to ${doing}. Check the key and organisation name in Vercel.`;
  if (status === 404) return `The Portal could not find that case — check the Portal case number. (${said})`;
  return `The Portal would not ${doing} (${status}): ${said}`;
}
