"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import Link from "next/link";

type JobLite = { id: string; address: string; description: string; pathway: string };

export function DashboardSearch({ jobs }: { jobs: JobLite[] }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const results = trimmed ? jobs.filter((j) => `${j.address} ${j.description}`.toLowerCase().includes(trimmed)) : [];

  return (
    <div>
      <div className="text-center mb-8">
        <div className="font-serif text-5xl font-medium tracking-tight text-slate-900">CertFlow</div>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by address"
          className="w-full pl-11 pr-4 py-3.5 rounded-lg text-sm outline-none bg-white border border-slate-200 focus:ring-2 focus:ring-teal-600/40"
          autoFocus
        />
      </div>
      {trimmed && (
        <div className="mt-4 rounded-lg overflow-hidden border border-slate-200 bg-white">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No projects match &ldquo;{trimmed}&rdquo;.</div>
          ) : (
            results.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`} className="block px-4 py-3 border-t border-slate-100 first:border-t-0 hover:bg-slate-50">
                <div className="font-medium text-sm text-slate-900">{j.address}</div>
                <div className="text-xs text-slate-500">
                  {j.pathway} · {j.description}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
