import type { SupabaseClient } from "@supabase/supabase-js";
import { portalConfig } from "@/lib/portal/config";
import { callPortal, extractChildCaseId } from "@/lib/portal/client";
import { initiateInspectionBody, performInspectionBody, completeInspectionBody, portalDocument, type PortalDocument } from "@/lib/portal/inspections";
import { recordAuditEvent } from "@/lib/audit";
import type { Profile } from "@/types/db";

// Reporting one CertFlow inspection to the NSW Planning Portal.
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
    inspectorName: string;
    registrationNumber: string;
  }
): Promise<PortalSendOutcome> {
  const config = portalConfig();
  if (!config) return { ok: false, error: "The Planning Portal connection is not set up yet — see Settings → System check." };

  const { caseId, jobId, jobAddress, inspection, inspectorName, registrationNumber } = input;

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

  // The signed report travels as a link the Portal downloads. An hour of
  // validity is far beyond what it needs, and the link dies afterwards.
  const documents: PortalDocument[] = [];
  if (inspection.report_pdf_path) {
    const { data: signed } = await supabase.storage.from("certflow-files").createSignedUrl(inspection.report_pdf_path, 3600);
    if (signed?.signedUrl) documents.push(portalDocument(`${inspection.title} inspection report.pdf`, signed.signedUrl));
  }
  if (documents.length === 0) {
    return { ok: false, error: "The signed inspection report could not be attached. Sign the report first — the Portal requires the document." };
  }

  // 1. Open the inspection case.
  const initiate = await callPortal(config, "POST", `/InitiateInspection/${encodeURIComponent(caseId)}`, initiateInspectionBody({
    certflowTitle: inspection.title,
    scheduledDate: inspection.date,
    registrationNumber,
  }));
  await log("InitiateInspection", initiate.ok, { status: initiate.status, response: initiate.body.slice(0, 2000) });
  if (!initiate.ok) return { ok: false, error: portalErrorMessage("open the inspection case", initiate.status, initiate.body) };

  const childCaseId = extractChildCaseId(initiate.body);
  if (!childCaseId) {
    await log("InitiateInspection", false, { status: initiate.status, response: initiate.body.slice(0, 2000), reason: "no inspection case id in the response" });
    return { ok: false, error: "The Portal accepted the request but its answer did not carry the new inspection case number. The full response is in the Audit page's activity log." };
  }

  // 2. Record the visit.
  const perform = await callPortal(config, "PUT", `/PerformInspection/${encodeURIComponent(caseId)}`, performInspectionBody({
    childCaseID: childCaseId,
    certflowTitle: inspection.title,
    inspectionDate: inspection.date,
    outcome: inspection.outcome,
    inspectorName,
    documents,
  }));
  await log("PerformInspection", perform.ok, { childCaseId, status: perform.status, response: perform.body.slice(0, 2000) });
  if (!perform.ok) return { ok: false, error: portalErrorMessage("record the inspection", perform.status, perform.body) };

  // 3. Close it out.
  const complete = await callPortal(config, "PUT", `/CompleteInspection/${encodeURIComponent(caseId)}`, completeInspectionBody({
    childCaseID: childCaseId,
    furtherInspectionRequired: inspection.outcome !== "passed",
    declarations: DECLARATION,
    inspectionResultDeclaration: CC_RESULT_DECLARATION,
    documents,
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
