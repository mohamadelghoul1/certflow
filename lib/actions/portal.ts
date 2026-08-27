"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flushJobUploads } from "@/lib/uploadDigest";

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

  // Runs as the signed-in client, and the function itself refuses any
  // item that isn't on one of their own jobs — so reaching the
  // notification below proves the upload was genuine.
  const { error } = await supabase.rpc("client_submit_document", {
    p_item_id: itemId,
    p_file_path: filePath,
    p_document_no: documentNo,
  });
  if (error) return { error: error.message };

  // The admin client, because a client's session can't read the
  // certifier's contact details through RLS — same as inspection
  // bookings, the other client-initiated notification.
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
    await admin.from("portal_uploads").insert({ job_id: jobId, item_title: item?.title || null, file_name: fileName });
    await flushJobUploads(admin, jobId, { requireSettled: false });
  }

  return {};
}
