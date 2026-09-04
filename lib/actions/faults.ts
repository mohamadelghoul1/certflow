"use server";

import { createClient } from "@/lib/supabase/server";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Marking a fault handled — looked at, fixed, or judged not worth
// chasing. It stays on the page with its history; if it happens again it
// reopens itself, because a fault that comes back was not fixed.
export async function resolveFault(formData: FormData) {
  const { userId } = await requireDirector();
  const supabase = await createClient();
  const id = String(formData.get("fault_id"));
  const reopen = String(formData.get("reopen")) === "true";

  await supabase
    .from("error_events")
    .update(reopen ? { resolved_at: null, resolved_by: null } : { resolved_at: new Date().toISOString(), resolved_by: userId })
    .eq("id", id);

  revalidatePath("/audit");
}
