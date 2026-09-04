"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, AlertTriangle, Trash2, Upload } from "lucide-react";

type JobRow = {
  id: string;
  address: string;
  description: string;
  projectNumber: string;
  status: string;
  needsAttention: boolean;
  certifierId: string | null;
  pathway: string;
  pathwayLabel: string;
  // The CDC/CC itself, issued — independent of the checklist's state.
  certIssued: boolean;
  certIssuedDate: string;
  // Set while a neighbour notification period is still running — a hold
  // on determining the certificate.
  notificationEnds: string;
  pathwayDone: boolean;
  // Every document approved, but the certificate not issued yet.
  pathwayToIssue: boolean;
  pathwayProgress: string | null;
  nocDone: boolean;
  nocProgress: string | null;
  inspDone: boolean;
  inspProgress: string | null;
  ocDone: boolean;
  ocToIssue: boolean;
  ocProgress: string | null;
};

// Green is reserved for a stage that is actually finished — the
// certificate issued, not merely every document approved. A checklist
// that is full but has issued nothing is the one state worth chasing, so
// it gets its own colour and says what it is waiting for rather than
// looking identical to a completed stage.
function StagePill({ label, done, toIssue, progress }: { label: string; done: boolean; toIssue?: boolean; progress: string | null }) {
  const tone = done
    ? "bg-success text-white"
    : toIssue
      ? "bg-warning-bg text-warning-text border border-warning/50"
      : progress
        ? "bg-hover text-secondary border border-line"
        : "bg-line text-placeholder";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${tone}`} title={toIssue ? `${label} checklist complete — not issued yet` : undefined}>
      {label}
      {progress ? ` ${progress}` : ""}
      {toIssue ? " · to issue" : ""}
    </span>
  );
}

export function JobsList({
  jobs,
  certifiers,
  deletedCount = 0,
  initialPathway = "",
  initialIssued = "",
  manage = true,
}: {
  jobs: JobRow[];
  certifiers: { id: string; name: string }[];
  deletedCount?: number;
  initialPathway?: string;
  initialIssued?: string;
  // A director creates, imports and restores projects; a team member
  // works the ones they have been given.
  manage?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [certifierFilter, setCertifierFilter] = useState("");
  // Seeded from the address bar so the Projects menu can link straight
  // to "all CDC projects" or "issued certificates".
  const [pathwayFilter, setPathwayFilter] = useState(initialPathway);
  const [issuedFilter, setIssuedFilter] = useState(initialIssued);

  const filtered = jobs.filter((j) => {
    if (query) {
      const haystack = `${j.address} ${j.description} ${j.projectNumber} ${j.id}`.toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    if (certifierFilter && j.certifierId !== certifierFilter) return false;
    if (pathwayFilter && j.pathway !== pathwayFilter) return false;
    if (issuedFilter === "issued" && !j.certIssued) return false;
    if (issuedFilter === "not-issued" && j.certIssued) return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-placeholder" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by project number or address"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-line bg-white text-sm text-muted placeholder-slate-400 outline-none focus:ring-2 focus:ring-icon"
          />
        </div>
        <select
          value={pathwayFilter}
          onChange={(e) => setPathwayFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-line bg-white text-sm text-muted outline-none focus:ring-2 focus:ring-icon"
        >
          <option value="">Service: All</option>
          <option value="CDC">CDC</option>
          <option value="CC">CC</option>
          <option value="PC_OC">PC / OC only</option>
        </select>
        <select
          value={issuedFilter}
          onChange={(e) => setIssuedFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-line bg-white text-sm text-muted outline-none focus:ring-2 focus:ring-icon"
        >
          <option value="">Certificate: Any</option>
          <option value="issued">Issued</option>
          <option value="not-issued">Not issued yet</option>
        </select>
        <select
          value={certifierFilter}
          onChange={(e) => setCertifierFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-line bg-white text-sm text-muted outline-none focus:ring-2 focus:ring-icon"
        >
          <option value="">Assigned certifier: Any</option>
          {certifiers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(query || certifierFilter || pathwayFilter || issuedFilter) && (
          <button
            onClick={() => {
              setQuery("");
              setCertifierFilter("");
              setPathwayFilter("");
              setIssuedFilter("");
            }}
            className="text-sm text-placeholder hover:text-muted hover:underline"
          >
            Clear
          </button>
        )}
        {manage && (
          <Link href="/jobs/new" className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
            <Plus size={16} /> New project
          </Link>
        )}
      </div>

      <div className="rounded-lg overflow-hidden border border-line bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-heading text-white text-left">
              <th className="px-5 py-3 font-semibold">Address</th>
              {/* On a phone the stage pills sit under the address rather
                  than in a column of their own, so a "Status" heading
                  pointing at empty space is dropped below sm. */}
              <th className="hidden sm:table-cell px-5 py-3 font-semibold sm:w-80">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => (
              <tr key={j.id} className="border-t border-line hover:bg-hover/60 transition-colors">
                <td className="px-0 py-0 align-top" colSpan={2}>
                  <Link href={`/jobs/${j.id}?tab=pathway`} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-primary">{j.address}</span>
                        {j.status === "complete" && <span className="px-2 py-0.5 rounded bg-success text-white text-[11px] font-semibold">Completed</span>}
                        {j.certIssued && (
                          <span className="px-2 py-0.5 rounded bg-success-bg text-success text-[11px] font-semibold">
                            {j.pathwayLabel} issued{j.certIssuedDate ? ` ${j.certIssuedDate}` : ""}
                          </span>
                        )}
                        {j.needsAttention && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-warning-bg text-warning-text text-[11px] font-semibold">
                            <AlertTriangle size={11} /> Amendment needed
                          </span>
                        )}
                        {j.notificationEnds && (
                          <span className="px-2 py-0.5 rounded bg-info-bg text-info text-[11px] font-semibold">Notification until {j.notificationEnds}</span>
                        )}
                      </div>
                      <div className="text-placeholder mt-0.5">{j.description}</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap w-full sm:w-80 sm:shrink-0 sm:justify-end">
                      <StagePill label={j.pathwayLabel} done={j.pathwayDone} toIssue={j.pathwayToIssue} progress={j.pathwayProgress} />
                      <StagePill label="NOC" done={j.nocDone} progress={j.nocProgress} />
                      <StagePill label="INSP" done={j.inspDone} progress={j.inspProgress} />
                      <StagePill label="OC" done={j.ocDone} toIssue={j.ocToIssue} progress={j.ocProgress} />
                    </div>
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-placeholder">
                  {query || certifierFilter || pathwayFilter || issuedFilter ? "No projects match your search." : 'No projects yet. Click "New project" to create your first one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {manage && (
      <div className="mt-4 flex items-center gap-4">
        <Link href="/jobs/import" className="inline-flex items-center gap-1.5 text-xs text-placeholder hover:text-muted hover:underline">
          <Upload size={13} /> Import projects from another system
        </Link>
        {deletedCount > 0 && (
          <Link href="/jobs/deleted" className="inline-flex items-center gap-1.5 text-xs text-placeholder hover:text-muted hover:underline">
            <Trash2 size={13} /> {deletedCount} deleted {deletedCount === 1 ? "project" : "projects"}
          </Link>
        )}
      </div>
      )}
    </div>
  );
}
