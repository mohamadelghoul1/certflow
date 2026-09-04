"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireDirector, requireJobWriter } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isIssueStage, stageLabel, type IssueStage } from "@/lib/issueApprovals";
import { firmSender, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/siteUrl";
import { recordAuditEvent } from "@/lib/audit";
import { escapeHtml } from "@/lib/html";
import type { ActionState } from "@/lib/actions/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

// What PostgREST says when migration 0074 has not been run.
const MISSING = ["42P01", "PGRST205", "PGRST106"];

function missing(code: string | undefined): boolean {
  return !!code && MISSING.includes(code);
}

const NOT_RUN = "Run database update 0074 first (Settings → System check) — until then a team member cannot ask for approval.";

// A team member asking a director to let them issue. The note is theirs
// to write: "checklist complete, portal ref recorded" is the difference
// between a decision made and a decision guessed at.
export async function requestIssueApproval(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const stage = formData.get("stage");
  if (!isIssueStage(stage)) return { error: "Nothing to ask about." };
  const note = String(formData.get("note") || "").trim().slice(0, 1000) || null;

  const { data: job } = await supabase.from("jobs").select("id, address, pathway").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "Project not found." };

  const { error } = await supabase.from("issue_approvals").insert({ job_id: jobId, stage, requested_by: profile.certifier_id, request_note: note });
  if (error) {
    if (missing(error.code)) return { error: NOT_RUN };
    // The one-open-request index: someone already asked.
    if (error.code === "23505") return { error: "A request for this is already with your directors." };
    return { error: error.message };
  }

  const what = stageLabel(stage, job.pathway as string);
  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    actor: profile,
    action: "issue.approval_requested",
    jobId,
    jobAddress: job.address,
    summary: `Asked a director to approve issuing the ${what} for ${job.address}`,
  });
  await tellDirectors(supabase, profile.firm_id, {
    subject: `Approval to issue: ${job.address}`,
    html: [
      `<p>${escapeHtml(profile.full_name || profile.email || "A team member")} is asking to issue the <strong>${escapeHtml(what)}</strong> for ${escapeHtml(job.address)}.</p>`,
      note ? `<p style="white-space:pre-wrap">${escapeHtml(note)}</p>` : "",
      `<p><a href="${await siteUrl()}/jobs/${jobId}">Open the project to approve or decline</a></p>`,
    ].join(""),
  });

  revalidatePath(`/jobs/${jobId}`);
  return { savedAt: Date.now() };
}

// The director's answer. Approving does not issue anything: it lets the
// person who asked press the button once.
export async function decideIssueApproval(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireDirector();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const id = String(formData.get("approval_id"));
  const approve = String(formData.get("decision")) === "approve";
  const note = String(formData.get("note") || "").trim().slice(0, 1000) || null;

  const [{ data: job }, { data: request }] = await Promise.all([
    supabase.from("jobs").select("id, address, pathway").eq("id", jobId).eq("firm_id", profile.firm_id).single(),
    supabase.from("issue_approvals").select("*").eq("id", id).eq("job_id", jobId).single(),
  ]);
  if (!job) return { error: "Project not found." };
  if (!request) return { error: "That request is no longer there." };
  if (request.status !== "pending") return { error: "That request has already been decided." };

  const { error } = await supabase
    .from("issue_approvals")
    .update({ status: approve ? "approved" : "declined", decided_by: profile.certifier_id, decided_at: new Date().toISOString(), decision_note: note })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { error: missing(error.code) ? NOT_RUN : error.message };

  const what = stageLabel(request.stage as IssueStage, job.pathway as string);
  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    actor: profile,
    action: approve ? "issue.approval_granted" : "issue.approval_declined",
    jobId,
    jobAddress: job.address,
    summary: `${approve ? "Approved" : "Declined"} issuing the ${what} for ${job.address}${note ? ` — ${note}` : ""}`,
  });

  // The person waiting is told, rather than having to keep looking.
  if (request.requested_by) {
    const { data: asker } = await supabase.from("certifiers").select("name, email").eq("id", request.requested_by).single();
    if (asker?.email) {
      await sendEmail(
        asker.email,
        `${approve ? "Approved" : "Not approved"}: issuing the ${what} for ${job.address}`,
        [
          `<p>${escapeHtml(profile.full_name || profile.email || "A director")} has ${approve ? "approved" : "declined"} issuing the <strong>${escapeHtml(what)}</strong> for ${escapeHtml(job.address)}.</p>`,
          note ? `<p style="white-space:pre-wrap">${escapeHtml(note)}</p>` : "",
          approve ? `<p>You can now issue it — once. Regenerating later asks again.</p>` : "",
          `<p><a href="${await siteUrl()}/jobs/${jobId}">Open the project</a></p>`,
        ].join(""),
        undefined,
        await firmSender(supabase, profile.firm_id)
      );
    }
  }

  revalidatePath(`/jobs/${jobId}`);
  return { savedAt: Date.now() };
}

// Every director with an email gets told. A firm without email sending
// switched on still gets the request — it is on the project page and on
// their dashboard; the email is the courtesy, not the mechanism.
async function tellDirectors(supabase: SupabaseClient, firmId: string, message: { subject: string; html: string }) {
  const { data: directors } = await supabase.from("certifiers").select("email").eq("firm_id", firmId).eq("firm_role", "director").not("email", "is", null);
  const sender = await firmSender(supabase, firmId);
  await Promise.all((directors || []).filter((d) => d.email).map((d) => sendEmail(d.email as string, message.subject, message.html, undefined, sender)));
}
