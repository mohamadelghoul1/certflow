import type { SupabaseClient } from "@supabase/supabase-js";

// What the firm's documents are actually costing in space.
//
// Storage grows quietly — nobody notices a project holding half a
// gigabyte of plan revisions until the bill does. This is the plain
// answer: the total, and which projects account for it, biggest first.

export type JobUsage = { jobId: string; address: string; bytes: number; files: number; isProject: boolean };
export type StorageUsage = {
  total: number;
  files: number;
  jobs: JobUsage[];
  available: boolean;
  // What the plan allows, in bytes, or null when nobody has said. The
  // limit belongs to the Supabase project this deployment points at, not
  // to a firm, so it is read from the environment rather than stored.
  limit: number | null;
};

// Storage sits in one Supabase project, and how much of it there is
// depends on the plan that project is on — which nothing in the database
// can be asked. So it is stated once in the environment, and the page
// says plainly that nobody has stated it rather than inventing a number
// and reporting headroom that may not exist.
export function storageLimitBytes(): number | null {
  const raw = (process.env.STORAGE_LIMIT_GB || "").trim();
  if (!raw) return null;
  const gb = Number(raw);
  if (!Number.isFinite(gb) || gb <= 0) return null;
  return Math.round(gb * 1_073_741_824);
}

// Everything a limit lets the page say. Rounded the way a person reads
// it: 0.4% used is "under 1%", not "0%".
export function storageHeadroom(total: number, limit: number | null) {
  if (!limit || limit <= 0) return null;
  const fraction = total / limit;
  return {
    limit,
    remaining: Math.max(0, limit - total),
    percent: fraction >= 0.01 ? Math.round(fraction * 100) : fraction > 0 ? 1 : 0,
    // Not a cliff but a warning: a firm at four fifths of its plan is a
    // firm that should decide about the next one before a client upload
    // is the thing that fails.
    nearingLimit: fraction >= 0.8,
    full: total >= limit,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / 1_048_576;
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// The folders under a firm that are the firm's own rather than a
// project's — see the upload paths in lib/actions.
const FIRM_FOLDERS: Record<string, string> = {
  library: "Document library — your blank forms",
  signatures: "Certifier signatures",
  "practice-logos": "Practice logos",
};

export async function getStorageUsage(supabase: SupabaseClient, firmId: string): Promise<StorageUsage> {
  const { data, error } = await supabase.rpc("firm_storage_usage");
  // Migration 0043 not run yet — the page says so rather than showing
  // an empty report that looks like "you are using nothing".
  if (error || !data) return { total: 0, files: 0, jobs: [], available: false, limit: storageLimitBytes() };

  const rows = data as { job_id: string; bytes: number; files: number }[];
  const { data: jobs } = await supabase.from("jobs").select("id, address").eq("firm_id", firmId);
  const addresses = new Map((jobs || []).map((j) => [j.id as string, (j.address as string) || "Untitled project"]));

  const usage: JobUsage[] = rows
    .map((r) => {
      const address = addresses.get(r.job_id);
      return {
        jobId: r.job_id,
        // Not every folder under a firm is a project. Logos, signatures
        // and the blank forms in the document library sit beside them,
        // and calling those "a project no longer listed" sent a
        // certifier looking for a project that never existed.
        address: address || FIRM_FOLDERS[r.job_id] || "Deleted project",
        bytes: Number(r.bytes) || 0,
        files: Number(r.files) || 0,
        isProject: !!address,
      };
    })
    .sort((a, b) => b.bytes - a.bytes);

  return {
    total: usage.reduce((sum, j) => sum + j.bytes, 0),
    files: usage.reduce((sum, j) => sum + j.files, 0),
    jobs: usage,
    available: true,
    limit: storageLimitBytes(),
  };
}
