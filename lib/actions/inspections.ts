"use server";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { todayISO, todayInNsw, formatISODate } from "@/lib/business";
import type { ActionState } from "@/lib/actions/auth";
import { inspectionDescriptionFor, MAX_INSPECTION_PHOTOS } from "@/lib/constants";
import { reorderedIds } from "@/lib/checklists";
import { storeSignedInspectionReport } from "@/lib/certificates/storeInspectionReport";
import { recordAuditEvent } from "@/lib/audit";
import { notifyJobClient } from "@/lib/email";
import { inspectionReportPdf } from "@/lib/pdf/inspectionReportFile";
import { inspectionReportEmail } from "@/lib/inspectionReportEmail";
import { sendInspectionToPortal } from "@/lib/portal/report";
import { isUnknownColumn } from "@/lib/softDelete";

export async function assignInspector(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const certifierId = String(formData.get("certifier_id") || "") || null;
  await supabase.from("inspections").update({ inspector_certifier_id: certifierId }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

// An inspection is a record of a visit that has happened, so it cannot be
// dated in the future. The date box stops one being picked; this stops one
// arriving any other way.
export async function setInspectionDate(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const entered = String(formData.get("date") || "");
  const date = entered && entered <= todayInNsw() ? entered : entered ? todayInNsw() : null;
  await supabase.from("inspections").update({ date, confirmed: true }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

// Recording an outcome is the moment an inspection becomes a thing that
// happened, and a report of a visit with no date on it is not much of a
// report. So an outcome with no date recorded against it stamps today —
// the certifier can still correct it in the date box afterwards.
export async function recordOutcome(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const outcome = String(formData.get("outcome"));

  const { data: existing } = await supabase.from("inspections").select("date").eq("id", inspectionId).single();
  const stampDate = outcome !== "pending" && !existing?.date;

  await supabase
    .from("inspections")
    .update({ outcome, updated_at: new Date().toISOString(), ...(stampDate ? { date: todayInNsw(), confirmed: true } : {}) })
    .eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

// The two prose parts of the generated report. Blank intro means "use the
// standard wording" rather than "print nothing", so clearing the box
// restores the default instead of leaving a gap.
export async function updateInspectionReportText(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const introOverride = String(formData.get("report_intro_override") || "").trim() || null;
  const notes = String(formData.get("report_notes") || "").trim() || null;

  await supabase.from("inspections").update({ report_intro_override: introOverride, report_notes: notes, updated_at: new Date().toISOString() }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs/[jobId]/inspections/[inspectionId]/report", "page");
}

export async function addDefect(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  await supabase.from("defects").insert({ inspection_id: inspectionId, text });
  revalidatePath(`/jobs/${jobId}`);
}

// The issues recorded against an inspection are a record of what was
// found on the day, not a to-do list to be worked through here — the
// report goes out naming them, and whether they are later rectified shows
// up as the next inspection. So they are simply editable text: correct
// the wording, or empty the box to drop the issue entirely.
export async function updateDefect(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const defectId = String(formData.get("defect_id"));
  const jobId = String(formData.get("job_id"));
  const text = String(formData.get("text") || "").trim();
  if (text) await supabase.from("defects").update({ text }).eq("id", defectId);
  else await supabase.from("defects").delete().eq("id", defectId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function removeDefect(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const defectId = String(formData.get("defect_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("defects").delete().eq("id", defectId);
  revalidatePath(`/jobs/${jobId}`);
}

// Sending the signed report to the client.
//
// This step existed as a flag nobody ever set: the report was signed,
// filed, and then sat there. A client learned what was found on their
// own site by asking. It now goes out as an email with the report
// attached, and appears in their portal — which is the whole point of
// signing it before leaving.
export async function sendReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));

  const { data: inspection } = await supabase.from("inspections").select("title, outcome, date, report_signed_at").eq("id", inspectionId).single();
  if (!inspection) return { error: "Could not find this inspection." };
  if (!inspection.report_signed_at) return { error: "Sign the report before sending it." };

  const { data: job } = await supabase.from("jobs").select("address").eq("id", jobId).single();
  const { subject, html } = inspectionReportEmail({
    title: inspection.title,
    outcome: inspection.outcome,
    date: inspection.date,
    address: job?.address || null,
  });

  // The report itself travels with the email. A client who has to log in
  // to find out whether their slab passed will ring instead.
  const file = await inspectionReportPdf(jobId, inspectionId, profile.firm_id);
  const outcome = await notifyJobClient(supabase, jobId, subject, html, file ? [{ filename: file.fileName, content: Buffer.from(file.bytes) }] : undefined);

  await supabase.from("inspections").update({ report_sent: true, report_sent_date: todayISO() }).eq("id", inspectionId);
  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "inspection.signed",
    summary: outcome.sent ? `Sent the ${inspection.title} inspection report to the client` : `Marked the ${inspection.title} inspection report sent, but the email did not go`,
    jobId,
    jobAddress: job?.address || null,
    actor: profile,
    detail: { inspectionId, emailed: outcome.sent },
    severity: outcome.sent ? "info" : "error",
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/site/${inspectionId}`);
  // Marked sent either way — the client can still see it in the portal —
  // but the certifier is told plainly when no email went.
  return outcome.sent ? undefined : { error: outcome.reason || "Marked as sent, but the email could not be delivered." };
}

export async function uploadInspectionReport(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const filePath = String(formData.get("file_path"));
  await supabase
    .from("inspections")
    .update({ report_file_path: filePath, report_sent: true, report_sent_date: todayISO() })
    .eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function signInspectionReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const { error, data } = await supabase.from("inspections").update({ report_signed_at: new Date().toISOString() }).eq("id", inspectionId).select("id, title, outcome, date");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Could not find this inspection to sign." };

  const signed = data[0];
  const { data: signedJob } = await supabase.from("jobs").select("address").eq("id", jobId).single();
  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "inspection.signed",
    summary: `Signed the ${signed.title} inspection report`,
    jobId,
    jobAddress: signedJob?.address || null,
    actor: profile,
    detail: { inspectionId, outcome: signed.outcome, date: signed.date },
  });

  // Built here rather than on every download. A signed report cannot
  // change until it is reopened, and this is a moment the certifier is
  // not watching — signing flips on the press and this happens behind
  // it. A failure leaves the download to build it on the fly, exactly as
  // it did before, so signing never fails for want of a PDF.
  try {
    const path = await storeSignedInspectionReport(supabase, jobId, inspectionId, profile.firm_id);
    if (path) await supabase.from("inspections").update({ report_pdf_path: path }).eq("id", inspectionId);
  } catch (buildError) {
    console.error("could not store the signed inspection report:", buildError instanceof Error ? buildError.message : buildError);
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/inspections/${inspectionId}/report`);
  return undefined;
}

// Signing a report is not the end of it: a date typed wrong, an issue
// worded badly, a photo that should have gone in. Reopening clears the
// signature — deliberately, because a signed report and an edited one
// must not be the same document — and the Sign button comes back so it
// can be signed again once the correction is made.
export async function unsignInspectionReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const { error, data } = await supabase.from("inspections").update({ report_signed_at: null, report_pdf_path: null }).eq("id", inspectionId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Could not find this inspection to reopen." };
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/inspections/${inspectionId}/report`);
  return undefined;
}

// Accepting the day the client asked for. The client's portal is waiting
// on this: until it happens their request reads as outstanding and they
// cannot ask again, so nothing here may fail quietly.
export async function confirmBooking(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const { data } = await supabase.from("inspections").update({ confirmed: true }).eq("id", inspectionId).select("title, date").maybeSingle();
  const row = data as { title: string; date: string | null } | null;

  if (row?.date) {
    await notifyJobClient(
      supabase,
      jobId,
      `Inspection confirmed — ${row.title}`,
      `<p>Your <strong>${row.title}</strong> inspection is confirmed for <strong>${formatISODate(row.date)}</strong>.</p>
       <p>Please make sure the site is ready and accessible on the day. If anything changes, let us know as early as you can.</p>`,
    );
  }

  revalidatePath(`/jobs/${jobId}`);
}

// Offering the client a different day.
//
// Not the date box beside it: that box records when a visit happened and
// refuses a future date, which is exactly the wrong rule for a booking
// that has not happened yet. This one takes the future date and tells
// the client, because a date changed without telling them is a certifier
// arriving on a day the builder is not expecting.
export async function rescheduleBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const date = String(formData.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick the day you want to inspect." };

  const { data, error } = await supabase
    .from("inspections")
    .update({ date, confirmed: true, booked_by_client: false, updated_at: new Date().toISOString() })
    .eq("id", inspectionId)
    .select("title")
    .maybeSingle();
  if (error) return { error: "That date could not be saved. Please try again." };

  const title = (data as { title: string } | null)?.title || "the";
  await notifyJobClient(
    supabase,
    jobId,
    `Inspection rescheduled — ${title}`,
    `<p>We could not make the day you asked for, so your <strong>${title}</strong> inspection has been booked for <strong>${formatISODate(date)}</strong> instead.</p>
     <p>Please make sure the site is ready and accessible on the day. If that date does not suit, call us and we will find another.</p>`,
  );

  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

// An inspection the job needs beyond the standard set: an occasional one
// (pool steel, a suspended slab, an OSD system, a fire rated wall), or a
// stage that has to be carried out a second time. Free text rather than a
// fixed list — the suggestions offered in the form are a shortcut, not a
// limit — because no list of stages covers every job.
export async function addInspection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const title = String(formData.get("title") || "").trim();
  if (!title) return { error: "Give the inspection a name." };

  // Scoped to the firm, the same way every other action that writes
  // against a job is.
  const { data: job } = await supabase.from("jobs").select("id, assigned_certifier_id").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "Project not found." };

  const description = inspectionDescriptionFor(title);
  const row = {
    job_id: jobId,
    title,
    description: description || null,
    // Whoever the job is assigned to, as the starter inspections are —
    // it can be changed on the card like any other.
    inspector_certifier_id: job.assigned_certifier_id,
  };

  // At the bottom of the list. Retried without the column for a database
  // where migration 0022 has not been run yet — PostgREST rejects the
  // whole insert if any column is unknown, and an inspection that
  // silently fails to save is far worse than one that lands unordered.
  const { error } = await supabase.from("inspections").insert({ ...row, sort_order: await nextInspectionOrder(supabase, jobId) });
  if (error && isUnknownColumn(error)) {
    const retry = await supabase.from("inspections").insert(row);
    if (retry.error) return { error: retry.error.message };
  } else if (error) {
    return { error: error.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

async function nextInspectionOrder(supabase: SupabaseClient, jobId: string) {
  const { data } = await supabase.from("inspections").select("sort_order").eq("job_id", jobId).order("sort_order", { ascending: false }).limit(1);
  const highest = data?.[0]?.sort_order;
  return typeof highest === "number" ? highest + 1 : 0;
}

// The order the inspections sit in on the job, the same way the checklist
// documents can be reordered. Does nothing on a database where migration
// 0022 has not been run — the arrows are simply inert rather than the
// page breaking.
export async function moveInspection(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const direction = String(formData.get("direction")) === "up" ? "up" : "down";

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return;

  const { data: siblings } = await supabase.from("inspections").select("id").eq("job_id", jobId).order("sort_order").order("created_at");
  if (!siblings) return;

  const reordered = reorderedIds(
    siblings.map((s) => s.id),
    inspectionId,
    direction
  );
  if (!reordered) return;

  await Promise.all(reordered.map((id, i) => supabase.from("inspections").update({ sort_order: i }).eq("id", id)));
  revalidatePath(`/jobs/${jobId}`);
}

// Reporting an inspection to the NSW Planning Portal is a statement to
// the regulator that it was carried out. Deleting it here afterwards
// would leave the app disagreeing with the Portal about what happened on
// the job, with nothing to show why — so once reported, it stays.
export async function removeInspection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));

  const { data: inspection } = await supabase.from("inspections").select("portal_reported, title, outcome, date, report_signed_at").eq("id", inspectionId).single();
  if (inspection?.portal_reported) return { error: "This inspection has been reported to the NSW Planning Portal and can no longer be removed." };

  const { error } = await supabase.from("inspections").delete().eq("id", inspectionId);
  if (error) return { error: error.message };

  // Only worth recording once the inspection was something: removing a
  // stage that was never carried out is housekeeping, not history.
  if (inspection?.outcome && inspection.outcome !== "pending") {
    const { data: job } = await supabase.from("jobs").select("address").eq("id", jobId).single();
    await recordAuditEvent(supabase, {
      firmId: profile.firm_id,
      action: "inspection.deleted",
      summary: `Removed the ${inspection.title} inspection, which had been carried out`,
      jobId,
      jobAddress: job?.address || null,
      actor: profile,
      detail: { outcome: inspection.outcome, date: inspection.date, wasSigned: !!inspection.report_signed_at },
      severity: "warning",
    });
  }

  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

// Capped here as well as in the picker: several photos chosen at once
// arrive as separate calls, and without a check each one only sees the
// count from before any of them landed.
export async function addPhoto(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const filePath = String(formData.get("file_path"));

  const { count } = await supabase.from("inspection_photos").select("id", { count: "exact", head: true }).eq("inspection_id", inspectionId);
  if ((count ?? 0) >= MAX_INSPECTION_PHOTOS) return;

  await supabase.from("inspection_photos").insert({ inspection_id: inspectionId, file_path: filePath });
  revalidatePath(`/jobs/${jobId}`);
}

export async function setPhotoCaption(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const photoId = String(formData.get("photo_id"));
  const jobId = String(formData.get("job_id"));
  const caption = String(formData.get("caption") || "");
  await supabase.from("inspection_photos").update({ caption }).eq("id", photoId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function removePhoto(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const photoId = String(formData.get("photo_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("inspection_photos").delete().eq("id", photoId);
  revalidatePath(`/jobs/${jobId}`);
}

// The manual fallback: marks the inspection as reported without talking
// to the Portal, for a firm that has not connected the API (or reported
// this one by hand on the Portal website).
export async function reportToPortal(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("inspections").update({ portal_reported: true, portal_reported_date: todayISO() }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

// Undoes a "reported" mark that was made by hand — pressing the old
// button marked the inspection without sending anything, and that mark
// blocks the real submission. Only a hand-made mark can be cleared: an
// inspection the API actually sent carries the Portal's own case number
// and stays put.
export async function unreportFromPortal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));

  const { data: inspection, error } = await supabase.from("inspections").select("id, portal_child_case_id").eq("id", inspectionId).single();
  if (error && !isUnknownColumn(error)) return { error: error.message };
  if (inspection && "portal_child_case_id" in inspection && inspection.portal_child_case_id) {
    return { error: "This inspection was sent through the Portal API and its record cannot be unmarked." };
  }

  await supabase.from("inspections").update({ portal_reported: false, portal_reported_date: null }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

// The real thing: sends the inspection to the NSW Planning Portal over
// the department's API — three calls, the signed report attached as a
// link — and only marks it reported once the Portal has accepted all
// three. Every request and response lands in the audit log either way.
export async function reportInspectionToPortalLive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const caseId = String(formData.get("portal_case_id") || "").trim();
  if (!caseId) return { error: "Enter the Portal case number this inspection belongs to." };

  const [{ data: job }, { data: inspection }] = await Promise.all([
    supabase.from("jobs").select("id, address").eq("id", jobId).eq("firm_id", profile.firm_id).single(),
    supabase.from("inspections").select("*").eq("id", inspectionId).eq("job_id", jobId).single(),
  ]);
  if (!job || !inspection) return { error: "Inspection not found." };
  if (inspection.portal_reported) return { error: "This inspection has already been reported to the Portal." };
  if (!inspection.report_signed_at) return { error: "Sign the inspection report first — the Portal submission carries the signed report." };

  const { data: inspector } = inspection.inspector_certifier_id
    ? await supabase.from("certifiers").select("name, registration_no").eq("id", inspection.inspector_certifier_id).single()
    : { data: null };
  if (!inspector?.name || !inspector.registration_no) {
    return { error: "Assign an inspector with a registration number to this inspection first — the Portal requires both." };
  }

  // The Portal requires the submitting user's registered email — the
  // account they sign into the Portal website with, which is not always
  // their Certlyn login. The panel asks for it, prefilled with the
  // Certlyn one.
  const portalEmail = String(formData.get("portal_user_email") || "").trim() || profile.email || "";
  if (!portalEmail) return { error: "Enter the email you sign into the Planning Portal with." };

  const { data: firm } = await supabase.from("firms").select("name").eq("id", profile.firm_id).single();

  const outcome = await sendInspectionToPortal(supabase, profile, {
    caseId,
    jobId,
    jobAddress: job.address,
    inspection,
    firmName: firm?.name || "",
    inspectorName: inspector.name,
    registrationNumber: inspector.registration_no,
    updatedByEmail: portalEmail,
    // A case the Portal already opened resumes automatically: the number
    // Certlyn remembered from an earlier attempt, or one typed into the
    // panel's recovery box.
    existingChildCaseId: String(formData.get("existing_child_case_id") || "").trim() || inspection.portal_child_case_id || null,
  });
  if (!outcome.ok) return { error: outcome.error };

  // The Portal's own case number for this inspection, kept for the
  // record. On a database that has not run migration 0030 the column is
  // missing; the report still went, so fall back to marking it reported.
  const reported = { portal_reported: true, portal_reported_date: todayISO() };
  const { error: saveError } = await supabase.from("inspections").update({ ...reported, portal_child_case_id: outcome.childCaseId }).eq("id", inspectionId);
  if (saveError && isUnknownColumn(saveError)) await supabase.from("inspections").update(reported).eq("id", inspectionId);

  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}
