"use client";

import { useState } from "react";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Event = { type: "CDC" | "CC" | "NOC" | "OC"; date: string };
type Bucket = { CDC: number; CC: number; NOC: number; OC: number; sortDate: number };

export function ReportsView({ events }: { events: Event[] }) {
  const [granularity, setGranularity] = useState<"month" | "year" | "all">("month");

  const bucketKey = (dt: Date) => {
    if (granularity === "all") return "All time";
    if (granularity === "year") return String(dt.getFullYear());
    return `${MONTH_ABBR[dt.getMonth()]} ${dt.getFullYear()}`;
  };

  const buckets: Record<string, Bucket> = {};
  for (const e of events) {
    const dt = new Date(e.date);
    const key = bucketKey(dt);
    if (!buckets[key]) buckets[key] = { CDC: 0, CC: 0, NOC: 0, OC: 0, sortDate: dt.getTime() };
    buckets[key][e.type] += 1;
    if (dt.getTime() > buckets[key].sortDate) buckets[key].sortDate = dt.getTime();
  }
  const rows = Object.entries(buckets).sort((a, b) => b[1].sortDate - a[1].sortDate);
  const totals = rows.reduce(
    (acc, [, v]) => ({ CDC: acc.CDC + v.CDC, CC: acc.CC + v.CC, NOC: acc.NOC + v.NOC, OC: acc.OC + v.OC }),
    { CDC: 0, CC: 0, NOC: 0, OC: 0 }
  );

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <div className="flex gap-2">
          {(
            [
              { key: "month", label: "By Month" },
              { key: "year", label: "By Year" },
              { key: "all", label: "All Time" },
            ] as const
          ).map((g) => (
            <button
              key={g.key}
              onClick={() => setGranularity(g.key)}
              className={`px-3.5 py-2 rounded-md text-sm font-semibold border ${granularity === g.key ? "bg-primary text-white border-primary" : "border-line text-muted hover:bg-hover"}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3 max-w-xl">
        {(["CDC", "CC", "NOC", "OC"] as const).map((t) => (
          <div key={t} className="bg-white rounded-lg border border-line px-4 py-3 text-center">
            <div className="text-2xl font-bold text-primary">{totals[t]}</div>
            <div className="text-xs text-placeholder">{t} issued</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg overflow-hidden border border-line bg-white max-w-3xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-heading text-white text-left">
              <th className="px-5 py-3 font-semibold">{granularity === "all" ? "Period" : granularity === "year" ? "Year" : "Month"}</th>
              <th className="px-5 py-3 font-semibold text-center w-20">CDC</th>
              <th className="px-5 py-3 font-semibold text-center w-20">CC</th>
              <th className="px-5 py-3 font-semibold text-center w-20">NOC</th>
              <th className="px-5 py-3 font-semibold text-center w-20">OC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, v]) => (
              <tr key={key} className="border-t border-line">
                <td className="px-5 py-3 font-medium text-primary">{key}</td>
                <td className="px-5 py-3 text-center">{v.CDC || "—"}</td>
                <td className="px-5 py-3 text-center">{v.CC || "—"}</td>
                <td className="px-5 py-3 text-center">{v.NOC || "—"}</td>
                <td className="px-5 py-3 text-center">{v.OC || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-placeholder">
                  No certificates or NOCs issued yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
