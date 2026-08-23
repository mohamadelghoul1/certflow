"use client";

import { pathwayLabel, type Pathway } from "@/lib/business";
import { useState } from "react";
import { Search } from "lucide-react";
import Link from "next/link";

type JobLite = { id: string; address: string; description: string; pathway: Pathway };

export function DashboardSearch({ jobs }: { jobs: JobLite[] }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const results = trimmed ? jobs.filter((j) => `${j.address} ${j.description}`.toLowerCase().includes(trimmed)) : [];

  return (
    <div>
      <div className="relative">
        <Search size={17} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by address…"
          className="w-full pl-12 pr-5 py-4 rounded-full text-sm outline-none bg-white border border-line shadow-sm transition-shadow focus:shadow-[0_0_0_4px_rgba(47,111,237,0.15)] focus:border-secondary"
          autoFocus
        />
      </div>
      {trimmed && (
        <div className="mt-3 rounded-xl overflow-hidden border border-line bg-white shadow-sm">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted">No projects match &ldquo;{trimmed}&rdquo;.</div>
          ) : (
            results.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}?tab=pathway`} className="block px-4 py-3 border-t border-line first:border-t-0 hover:bg-hover">
                <div className="font-medium text-sm text-heading">{j.address}</div>
                <div className="text-xs text-muted">
                  {pathwayLabel(j.pathway)} · {j.description}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
