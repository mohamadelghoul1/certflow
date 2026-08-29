"use client";

import Link from "next/link";
import { AlertTriangle, HardDrive, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { clearOrphanedFiles } from "@/lib/actions/storage";
import type { ActionState } from "@/lib/actions/auth";
import { formatBytes, storageHeadroom, type StorageUsage } from "@/lib/storageUsage";

// Where the firm's storage is going. Sorted biggest first, because the
// only useful question is which handful of projects account for most of
// it — the long tail never matters.
export function StorageSection({ usage }: { usage: StorageUsage }) {
  if (!usage.available) {
    return (
      <div className="rounded-md border border-warning/50 bg-warning-bg px-4 py-3 text-sm text-warning-text">
        This report needs database update <span className="font-mono text-xs">0043</span>. Run it in the Supabase SQL editor and this page will fill in.
      </div>
    );
  }

  const biggest = usage.jobs[0]?.bytes || 1;
  const projects = usage.jobs.filter((j) => j.isProject).length;
  const headroom = storageHeadroom(usage.total, usage.limit);
  // Files left behind by projects that were purged before the delete was
  // recursive. They are invisible to the app and still cost quota.
  const orphans = usage.jobs.filter((j) => !j.isProject && j.address === "Deleted project");
  const orphanBytes = orphans.reduce((sum, j) => sum + j.bytes, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-line bg-white px-5 py-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="rounded-full bg-surface p-3 text-secondary shrink-0">
            <HardDrive size={20} />
          </span>
          <div>
            <div className="text-2xl font-bold text-primary">
              {formatBytes(usage.total)}
              {headroom && <span className="text-base font-semibold text-muted"> of {formatBytes(headroom.limit)}</span>}
            </div>
            {/* Not every file is in a project — logos, signatures and the
                blank forms in the document library are the firm's own —
                so saying they were all in projects was simply untrue. */}
            <div className="text-xs text-placeholder">
              {usage.files.toLocaleString()} file{usage.files === 1 ? "" : "s"} across {projects} project{projects === 1 ? "" : "s"}
              {usage.jobs.length > projects ? ", plus your firm's own files" : ""}
            </div>
          </div>
          <div className="ml-auto text-xs text-muted max-w-xs">
            Superseded versions are cleared automatically when the approval, the Notice of Commencement and the Occupation Certificate are issued.
          </div>
        </div>

        {headroom ? (
          <div className="mt-4">
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${headroom.full ? "bg-error" : headroom.nearingLimit ? "bg-warning" : "bg-secondary"}`}
                style={{ width: `${Math.min(100, Math.max(1, headroom.percent))}%` }}
              />
            </div>
            <div className="flex items-baseline justify-between gap-3 mt-1.5 flex-wrap">
              <span className="text-xs text-muted">
                {headroom.percent}% used · <span className="font-semibold text-heading">{formatBytes(headroom.remaining)}</span> left
              </span>
              {(headroom.nearingLimit || headroom.full) && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-text">
                  <AlertTriangle size={13} />
                  {headroom.full ? "Full — uploads will start failing" : "Getting close to the limit"}
                </span>
              )}
            </div>
          </div>
        ) : (
          // Nobody has said what the plan allows, and guessing would
          // report headroom that may not exist.
          <div className="mt-4 text-xs text-muted border-t border-line pt-3">
            <span className="font-semibold text-heading">No limit recorded.</span> Your storage sits in Supabase, and how much you get depends on
            the plan that project is on. Look it up under <span className="font-medium">Supabase → Settings → Usage</span>, then add{" "}
            <span className="font-mono text-[11px] bg-surface px-1 py-0.5 rounded">STORAGE_LIMIT_GB</span> in Vercel — for example{" "}
            <span className="font-mono text-[11px]">1</span> for one gigabyte — and this page will show what is left.
          </div>
        )}
      </div>

      {orphans.length > 0 && <OrphanedFiles count={orphans.length} bytes={orphanBytes} />}

      {usage.jobs.length === 0 ? (
        <div className="text-sm text-muted">No documents stored yet.</div>
      ) : (
        <div className="rounded-lg border border-line overflow-hidden bg-white">
          {usage.jobs.map((job) => (
            <div key={job.jobId} className="px-5 py-3 border-b border-line last:border-b-0">
              <div className="flex items-baseline justify-between gap-4">
                {job.isProject ? (
                  <Link href={`/jobs/${job.jobId}`} className="text-sm font-semibold text-primary hover:underline truncate">
                    {job.address}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-muted truncate">{job.address}</span>
                )}
                <div className="text-sm font-semibold text-heading shrink-0">{formatBytes(job.bytes)}</div>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="h-1.5 flex-1 bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.max(2, Math.round((job.bytes / biggest) * 100))}%` }} />
                </div>
                <div className="text-[11px] text-placeholder shrink-0">
                  {job.files} file{job.files === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Documents belonging to projects that no longer exist.
//
// Offered rather than swept: these are documents, a certifier holds
// records for years, and deciding they are gone is a decision — not
// something that should happen overnight without anyone saying so.
function OrphanedFiles({ count, bytes }: { count: number; bytes: number }) {
  const [state, clear, clearing] = useActionState<ActionState, FormData>(clearOrphanedFiles, undefined);

  return (
    <div className="rounded-lg border border-warning/50 bg-warning-bg px-5 py-4">
      <div className="flex items-start gap-2 text-sm font-semibold text-warning-text">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <span>
          {formatBytes(bytes)} belongs to {count} project{count === 1 ? "" : "s"} that {count === 1 ? "has" : "have"} been deleted
        </span>
      </div>
      <p className="text-xs text-warning-text mt-1.5">
        Deleting a project was supposed to take its documents with it and, until a recent fix, did not. These files are no longer reachable from
        anywhere in CertFlow, but they still count against your storage. Clearing them cannot be undone.
      </p>
      <form action={clear} className="mt-2.5">
        <button
          disabled={clearing}
          className="inline-flex items-center gap-1.5 bg-error text-white rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-60"
        >
          <Trash2 size={13} /> {clearing ? "Clearing…" : `Clear ${formatBytes(bytes)}`}
        </button>
      </form>
      {state?.error && <div className="text-[11px] text-error mt-1.5">{state.error}</div>}
    </div>
  );
}
