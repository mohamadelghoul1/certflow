"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/actions/auth";

// Replacing a calendar address that has been shared too widely.
//
// Done through the database function rather than an update here, so the
// firm check lives with the data: it can only ever replace a token
// belonging to the caller's own firm, whatever this action is passed.
export async function resetCalendarLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const certifierId = String(formData.get("certifier_id") || "");
  if (!certifierId) return { error: "There was no calendar to replace." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_calendar_token", { p_certifier_id: certifierId });
  if (error || !data) return { error: "That calendar address could not be replaced. Please try again." };

  // Worth a line in the audit log: the old address stops working, and
  // somebody whose phone quietly stops updating should be able to find
  // out why.
  await recordAuditEvent(createAdminClient(), {
    firmId: profile.firm_id,
    action: "calendar.link_replaced",
    summary: "Replaced the inspection calendar address",
    severity: "info",
  });

  revalidatePath("/calendar");
  return undefined;
}
