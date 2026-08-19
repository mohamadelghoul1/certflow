"use client";

import { deletePathwayVersion } from "@/lib/actions/jobs";

export function DeletePathwayVersionButton({ jobId, versionId, versionLabel }: { jobId: string; versionId: string; versionLabel: string }) {
  return (
    <button
      className="text-xs text-red-500 hover:underline"
      onClick={() => {
        if (confirm(`Delete ${versionLabel}? This removes it and its uploaded approval permanently — it can't be undone.`)) {
          const fd = new FormData();
          fd.set("job_id", jobId);
          fd.set("version_id", versionId);
          deletePathwayVersion(fd);
        }
      }}
    >
      Delete
    </button>
  );
}
