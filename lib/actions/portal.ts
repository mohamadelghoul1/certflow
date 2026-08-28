"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flushJobUploads, digestEmail } from "@/lib/uploadDigest";
import { notifyJobCertifier } from "@/lib/email";
import { currentDocuments } from "@/lib/checklistDocuments";

// A client sending a document in from the portal. The file itself is
// uploaded straight from their browser to storage; this records it
// against the checklist item and then tells the assigned certifier —
// the one event that used to happen silently, leaving documents sitting
// unnoticed until the certifier next opened the job.
export async function submitClientDocument({
  itemId,
  filePath,
  documentNo,
  fileName,
}: {
  itemId: string;
  filePath: string;
  documentNo: number | null;
  fileName: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();

  // One document per item: once it's sent, the item is closed to the
  // client until the certifier asks for something more. Enforced here as
  // well as in the portal's buttons, so a tab left open from before the
  // document was sent can't slip a second one in behind it.
  const { data: item } = await supabase
    .from("checklist_items")
    .select("status, file_path, amendments(resolved), checklist_item_files(*)")
    .eq("id", itemId)
    .single();
  if (item) {
    const alreadySent = currentDocuments(item).length > 0;
    const changesRequested = ((item.amendments as { resolved: boolean }[] | null) || []).some((a) => !a.resolved);
    if (item.status === "approved") return { error: "This document has been approved — your certifier can replace it if it needs to change." };
    if (alreadySent && !changesRequested) {
      return { error: "This document is with your certifier for review. You'll be able to send another once they ask for changes." };
    }
  }

  // Runs as the signed-in client, and the function itself refuses any
  // item that isn't on one of their own jobs — so reaching the
  // notification below proves the upload was genuine.
  const { error } = await supabase.rpc("client_submit_document", {
    p_item_id: itemId,
    p_file_path: filePath,
    p_document_no: documentNo,
  });
  if (error) return { error: error.message };

  // The notification is the certifier's concern, not the client's — so it
  // runs after the response has already gone back and the client's screen
  // has moved on, instead of holding the upload spinner for the lookups
  // and the email send.
  //
  // The admin client, because a client's session can't read the
  // certifier's contact details through RLS — same as inspection
  // bookings, the other client-initiated notification.
  after(async () => {
    try {
      const admin = createAdminClient();
      const { data: item } = await admin.from("checklist_items").select("title, checklist_id").eq("id", itemId).single();
      const { data: checklist } = item
        ? await admin.from("checklists").select("job_id").eq("id", item.checklist_id).single()
        : { data: null };
      const jobId = checklist?.job_id as string | undefined;
      if (jobId) {
        // Recorded, then batched: the first document of a burst emails the
        // certifier straight away; anything more inside the quiet window
        // rides along in the next summary instead of its own email.
        const { error: recordError } = await admin
          .from("portal_uploads")
          .insert({ job_id: jobId, item_title: item?.title || null, file_name: fileName });
        if (recordError) {
          // The batching table isn't there (migration not run yet) or the
          // insert failed some other way. Losing the batching is fine;
          // losing the notification is not — email directly instead.
          const { data: job } = await admin.from("jobs").select("address").eq("id", jobId).single();
          const { subject, html } = digestEmail([{ item_title: item?.title || null, file_name: fileName }], job?.address ?? null);
          await notifyJobCertifier(admin, jobId, subject, html);
        } else {
          await flushJobUploads(admin, jobId, { requireSettled: false });
        }
      }
    } catch (err) {
      // A failed notification must not look like a failed upload — the
      // document itself is already safely recorded by this point.
      console.error("upload notification failed", err);
    }
  });

  return {};
}

// The client's own copy of an issued certificate, sent in from the
// portal.
//
// It is filed beside the certificate, never over it: what the firm
// issued stays exactly as issued, and this sits next to it as "the copy
// the applicant has". The certifier is told the same way they are told
// about any other document a client sends in, so a copy that arrives on
// a Friday afternoon is not waiting to be noticed on Monday.
export async function submitApprovalCopy({
  jobId,
  kind,
  ocRecordId,
  filePath,
  fileName,
  label,
}: {
  jobId: string;
  kind: "pathway" | "oc";
  ocRecordId: string | null;
  filePath: string;
  fileName: string;
  // What to call it in the certifier's alert — "the CDC certificate",
  // "the Whole Occupation Certificate".
  label: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again and try that once more." };

  // Row security does the deciding: the insert only succeeds on a job
  // this client can see, and only for an OC record on that same job.
  const { error } = await supabase.from("client_approval_copies").insert({
    job_id: jobId,
    kind,
    oc_record_id: ocRecordId,
    file_path: filePath,
    file_name: fileName,
    uploaded_by: user.id,
  });
  if (error) {
    if (missingTable(error)) return { error: "This isn't switched on yet — let your certifier know so they can finish setting it up." };
    return { error: error.message };
  }

  after(async () => {
    try {
      const admin = createAdminClient();
      const title = `Copy of ${label}`;
      const { error: recordError } = await admin.from("portal_uploads").insert({ job_id: jobId, item_title: title, file_name: fileName });
      if (recordError) {
        const { data: job } = await admin.from("jobs").select("address").eq("id", jobId).single();
        const { subject, html } = digestEmail([{ item_title: title, file_name: fileName }], job?.address ?? null);
        await notifyJobCertifier(admin, jobId, subject, html);
      } else {
        await flushJobUploads(admin, jobId, { requireSettled: false });
      }
    } catch (err) {
      console.error("approval copy notification failed", err);
    }
  });

  return {};
}

// Taking back a copy sent by mistake — the ordinary error here is the
// wrong file, not a change of heart. Row security allows only the person
// who uploaded it; the stored file is then removed with the admin
// client, because clients can write to storage but not delete from it.
export async function removeApprovalCopy({ id }: { id: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_approval_copies").delete().eq("id", id).select("file_path");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "That copy has already been removed." };

  const paths = data.map((row) => row.file_path).filter(Boolean);
  if (paths.length > 0) await createAdminClient().storage.from("certflow-files").remove(paths);
  return {};
}

// A database that hasn't had migration 0046 run yet, said in the four
// ways PostgREST says it.
function missingTable(error: { code?: string | null }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204" || error.code === "42703";
}
