import type { SupabaseClient } from "@supabase/supabase-js";
import { providerFor, remotePath } from "@/lib/backup/providers";
import { usableAccessToken, type Connection } from "@/lib/backup/connection";

// A copy of the record, not just the documents.
//
// Cloud backup copies the files a job produced. It does not copy what
// makes them mean anything: which certificate numbers were issued,
// against which jobs, on which dates, with which inspection outcomes,
// and the audit trail behind them. Lose the database and a certifier is
// left holding PDFs and no register of what they certified.
//
// The export is JSON rather than a spreadsheet, because it has to be
// possible to put back. A spreadsheet loses the shape — which document
// belonged to which item, which inspection to which job — and the shape
// is most of the value.

export type FirmExport = {
  exported_at: string;
  firm_id: string;
  format: string;
  excluded: { tables: string[]; why: string };
  tables: Record<string, unknown[]>;
};

export async function exportFirmDatabase(client: SupabaseClient, firmId: string): Promise<FirmExport | { error: string }> {
  const { data, error } = await client.rpc("export_firm_data", { p_firm_id: firmId });
  if (error) {
    return {
      error:
        error.code === "PGRST202" || error.code === "42883"
          ? "Run database update 0063 first (Settings → System check)."
          : error.message,
    };
  }
  return data as FirmExport;
}

// What one export is worth knowing about at a glance: how much of the
// record it holds. A backup file that has quietly become empty looks
// exactly like one that is fine until the day it is needed.
export function exportSummary(exported: FirmExport): { rows: number; tables: number } {
  const tables = Object.values(exported.tables || {});
  return { tables: tables.length, rows: tables.reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0) };
}

export function exportFileName(exported: FirmExport, now = new Date()): string {
  return `certlyn-records-${now.toISOString().slice(0, 10)}.json`;
}

// Sent to the firm's own cloud storage, beside the documents, under a
// folder of its own so a year of daily copies does not bury the job
// folders someone actually browses.
export async function uploadFirmDatabaseBackup(
  connection: Connection,
  exported: FirmExport,
  now = new Date()
): Promise<{ uploaded: boolean; error?: string }> {
  const provider = providerFor(connection.provider);
  if (!provider) return { uploaded: false, error: "Unknown cloud provider." };

  try {
    const accessToken = await usableAccessToken(connection);
    const body = new TextEncoder().encode(JSON.stringify(exported, null, 2));
    if (body.byteLength > provider.simpleUploadLimit) {
      return {
        uploaded: false,
        error: `The record is larger than ${provider.label} accepts in one piece (${Math.round(body.byteLength / 1024 / 1024)} MB).`,
      };
    }

    const path = remotePath(connection.root_folder, "Certlyn records", exportFileName(exported, now));
    const request = provider.uploadRequest({ accessToken, remotePath: path, size: body.byteLength });
    const res = await fetch(request.url, { method: request.method, headers: request.headers, body });
    if (!res.ok) return { uploaded: false, error: `${provider.label} refused it (${res.status}).` };
    return { uploaded: true };
  } catch (err) {
    return { uploaded: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// The nightly copy, for every firm that has connected a cloud account.
// A firm that has not connected one still has the download button; this
// is for the firms that would rather not remember.
export async function runDatabaseBackups(admin: SupabaseClient, now = new Date()): Promise<{ firms: number; uploaded: number; failed: number }> {
  const { data: connections } = await admin.from("cloud_backup_connections").select("*");
  let uploaded = 0;
  let failed = 0;

  for (const connection of (connections || []) as Connection[]) {
    const exported = await exportFirmDatabase(admin, connection.firm_id);
    if ("error" in exported) {
      failed += 1;
      continue;
    }
    const result = await uploadFirmDatabaseBackup(connection, exported, now);
    if (result.uploaded) uploaded += 1;
    else failed += 1;
  }

  return { firms: (connections || []).length, uploaded, failed };
}
