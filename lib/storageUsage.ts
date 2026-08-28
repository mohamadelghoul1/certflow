import type { SupabaseClient } from "@supabase/supabase-js";

// What the firm's documents are actually costing in space.
//
// Storage grows quietly — nobody notices a project holding half a
// gigabyte of plan revisions until the bill does. This is the plain
// answer: the total, and which projects account for it, biggest first.

export type JobUsage = { jobId: string; address: string; bytes: number; files: number };
export type StorageUsage = { total: number; files: number; jobs: JobUsage[]; available: boolean };

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / 1_048_576;
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export async function getStorageUsage(supabase: SupabaseClient, firmId: string): Promise<StorageUsage> {
  const { data, error } = await supabase.rpc("firm_storage_usage");
  // Migration 0043 not run yet — the page says so rather than showing
  // an empty report that looks like "you are using nothing".
  if (error || !data) return { total: 0, files: 0, jobs: [], available: false };

  const rows = data as { job_id: string; bytes: number; files: number }[];
  const { data: jobs } = await supabase.from("jobs").select("id, address").eq("firm_id", firmId);
  const addresses = new Map((jobs || []).map((j) => [j.id as string, (j.address as string) || "Untitled project"]));

  const usage: JobUsage[] = rows
    .map((r) => ({
      jobId: r.job_id,
      // A project deleted from CertFlow can still be holding files.
      address: addresses.get(r.job_id) || "Project no longer listed",
      bytes: Number(r.bytes) || 0,
      files: Number(r.files) || 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    total: usage.reduce((sum, j) => sum + j.bytes, 0),
    files: usage.reduce((sum, j) => sum + j.files, 0),
    jobs: usage,
    available: true,
  };
}
