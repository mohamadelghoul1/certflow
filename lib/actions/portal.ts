"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flushJobUploads, digestEmail } from "@/lib/uploadDigest";
import { notifyJobCertifier } from "@/lib/email";
import { requireProfile } from "@/lib/auth";
import { formatISODate } from "@/lib/business";
import { escapeHtml } from "@/lib/html";
import { currentDocuments } from "@/lib/checklistDocuments";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/uploads";

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

  // The file's real size, asked of storage rather than taken from the
  // browser, which reports whatever it likes. This is the only place a
  // client's limit can be applied: a check in the upload component is
  // advice, and a limit on the bucket would cap the certifier too, who
  // is deliberately not capped.
  //
  // Over the limit, the file is removed rather than left orphaned —
  // it was written before this ran, and nothing else would ever point
  // at it.
  const { data: uploaded } = await supabase.storage.from("certflow-files").info(filePath);
  const uploadedSize = (uploaded as { size?: number } | null)?.size;
  if (typeof uploadedSize === "number" && uploadedSize > MAX_UPLOAD_BYTES) {
    await supabase.storage.from("certflow-files").remove([filePath]);
    return { error: `That file is ${Math.ceil(uploadedSize / (1024 * 1024))} MB and the limit is ${MAX_UPLOAD_MB} MB. Send it as a PDF, or split it into parts.` };
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

// Telling the certifier their client has booked an inspection.
//
// This used to be a public API route: no session, the service role, and
// the inspection id, job id and date all taken from whoever posted. So
// anyone on the internet could email any certifier in the system about
// any inspection, learn its title from the reply, and — because a date
// that will not parse is printed back verbatim — put their own markup
// in the body of it. Unmetered, through the firm's own mail account.
//
// Now it is a server action: the caller must be a signed-in client, the
// inspection must be one row security lets them see, and the job and the
// date are read from the database rather than accepted from the caller.
// Nothing the browser sends reaches the email.
export async function notifyInspectionBooked(inspectionId: string): Promise<void> {
  await requireProfile("client");
  const supabase = await createClient();

  // Read through the client's own session: "client read inspections" is
  // scoped to the jobs they can see, so a row coming back at all is the
  // proof that this booking is theirs.
  const { data: inspection } = await supabase
    .from("inspections")
    .select("id, job_id, title, date")
    .eq("id", inspectionId)
    .maybeSingle();
  if (!inspection) return;

  await notifyJobCertifier(
    createAdminClient(),
    inspection.job_id,
    "Client booked an inspection",
    `<p>Your client has booked the <strong>${escapeHtml(inspection.title || "an")}</strong> inspection for <strong>${formatISODate(inspection.date)}</strong>. Please confirm it in Certlyn.</p>`
  );
}
