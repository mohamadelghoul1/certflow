import Link from "next/link";
import { HardDrive } from "lucide-react";
import { formatBytes, type StorageUsage } from "@/lib/storageUsage";

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

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-line bg-white px-5 py-4 flex items-center gap-4">
        <span className="rounded-full bg-surface p-3 text-secondary">
          <HardDrive size={20} />
        </span>
        <div>
          <div className="text-2xl font-bold text-primary">{formatBytes(usage.total)}</div>
          <div className="text-xs text-placeholder">
            across {usage.files.toLocaleString()} file{usage.files === 1 ? "" : "s"} in {usage.jobs.length} project{usage.jobs.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="ml-auto text-xs text-muted max-w-xs">
          Superseded versions are cleared automatically when the approval, the Notice of Commencement and the Occupation Certificate are issued.
        </div>
      </div>

      {usage.jobs.length === 0 ? (
        <div className="text-sm text-muted">No documents stored yet.</div>
      ) : (
        <div className="rounded-lg border border-line overflow-hidden bg-white">
          {usage.jobs.map((job) => (
            <div key={job.jobId} className="px-5 py-3 border-b border-line last:border-b-0">
              <div className="flex items-baseline justify-between gap-4">
                <Link href={`/jobs/${job.jobId}`} className="text-sm font-semibold text-primary hover:underline truncate">
                  {job.address}
                </Link>
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
