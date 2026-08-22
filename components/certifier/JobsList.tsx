"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, AlertTriangle } from "lucide-react";

type JobRow = {
  id: string;
  address: string;
  description: string;
  projectNumber: string;
  status: string;
  needsAttention: boolean;
  certifierId: string | null;
  pathwayLabel: string;
  pathwayDone: boolean;
  pathwayProgress: string | null;
  nocDone: boolean;
  nocProgress: string | null;
  inspDone: boolean;
  inspProgress: string | null;
  ocDone: boolean;
  ocProgress: string | null;
};

function StagePill({ label, done, progress }: { label: string; done: boolean; progress: string | null }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${
        done ? "bg-success text-white" : progress ? "bg-hover text-secondary border border-line" : "bg-line text-placeholder"
      }`}
    >
      {label}
      {progress ? ` ${progress}` : ""}
    </span>
  );
}

export function JobsList({ jobs, certifiers }: { jobs: JobRow[]; certifiers: { id: string; name: string }[] }) {
  const [query, setQuery] = useState("");
  const [certifierFilter, setCertifierFilter] = useState("");

  const filtered = jobs.filter((j) => {
    if (query) {
      const haystack = `${j.address} ${j.description} ${j.projectNumber} ${j.id}`.toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    if (certifierFilter && j.certifierId !== certifierFilter) return false;
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
        {(query || certifierFilter) && (
          <button
            onClick={() => {
              setQuery("");
              setCertifierFilter("");
            }}
            className="text-sm text-placeholder hover:text-muted hover:underline"
          >
            Clear
          </button>
        )}
        <Link href="/jobs/new" className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
          <Plus size={16} /> New project
        </Link>
      </div>

      <div className="rounded-lg overflow-hidden border border-line bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-heading text-white text-left">
              <th className="px-5 py-3 font-semibold">Address</th>
              <th className="px-5 py-3 font-semibold w-80">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => (
              <tr key={j.id} className="border-t border-line hover:bg-hover/60 transition-colors">
                <td className="px-0 py-0 align-top" colSpan={2}>
                  <Link href={`/jobs/${j.id}?tab=pathway`} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary">{j.address}</span>
                        {j.status === "complete" && <span className="px-2 py-0.5 rounded bg-success text-white text-[11px] font-semibold">Completed</span>}
                        {j.needsAttention && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-warning-bg text-warning-text text-[11px] font-semibold">
                            <AlertTriangle size={11} /> Amendment needed
                          </span>
                        )}
                      </div>
                      <div className="text-placeholder mt-0.5">{j.description}</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end w-80">
                      <StagePill label={j.pathwayLabel} done={j.pathwayDone} progress={j.pathwayProgress} />
                      <StagePill label="NOC" done={j.nocDone} progress={j.nocProgress} />
                      <StagePill label="INSP" done={j.inspDone} progress={j.inspProgress} />
                      <StagePill label="OC" done={j.ocDone} progress={j.ocProgress} />
                    </div>
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-placeholder">
                  {query || certifierFilter ? "No projects match your search." : 'No projects yet. Click "New project" to create your first one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
