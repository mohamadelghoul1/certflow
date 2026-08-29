"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { configuredProviders, type Connection, type ConnectionStatus } from "@/lib/backup/connection";
import type { ActionState } from "@/lib/actions/auth";
import type { ProviderId } from "@/lib/backup/providers";

// Never returns a token. The connection rows hold live credentials to a
// firm's own cloud storage, and the only things the app needs to show are
// which account it is and how the last run went.
export async function getBackupStatus(firmId: string): Promise<{ configured: ProviderId[]; connections: ConnectionStatus[] }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cloud_backup_connections")
    .select("id, provider, account_label, root_folder, connected_at, last_sync_at, last_sync_error")
    .eq("firm_id", firmId);
  return { configured: configuredProviders(), connections: (data || []) as ConnectionStatus[] };
}

export async function disconnectBackup(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const admin = createAdminClient();
  // The record of what has been copied goes with it: reconnecting a
  // different account should copy everything up again rather than assume
  // the new account already holds files the old one did.
  await admin.from("cloud_backup_connections").delete().eq("id", String(formData.get("connection_id"))).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

