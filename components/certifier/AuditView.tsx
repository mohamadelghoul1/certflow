"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatISODate } from "@/lib/business";

type Event = { certifierId: string; type: "cdc_cc" | "modification" | "oc" | "inspection"; action: string; address: string; date: string };
type CertifierRow = { id: string; name: string; registration_no: string | null; registration_body: string | null };

export function AuditView({ certifiers, events }: { certifiers: CertifierRow[]; events: Event[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <h1 className="text-xl font-bold text-teal-900 mb-1">Certifier Audit</h1>
      <p className="text-slate-500 text-sm mb-6 max-w-2xl">
        What each registered certifier has actually issued or carried out, across every project — derived from real issuance and inspection records, not a separate log.
      </p>

      <div className="space-y-4 max-w-3xl">
        {certifiers.map((c) => {
          const own = events.filter((e) => e.certifierId === c.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const cdcCount = own.filter((e) => e.type === "cdc_cc").length;
          const modCount = own.filter((e) => e.type === "modification").length;
          const ocCount = own.filter((e) => e.type === "oc").length;
          const inspCount = own.filter((e) => e.type === "inspection").length;
          const inspPassed = own.filter((e) => e.type === "inspection" && e.action.includes("(Passed)")).length;
          const inspFailed = own.filter((e) => e.type === "inspection" && e.action.includes("(Failed)")).length;
          const isOpen = expanded === c.id;

          return (
            <div key={c.id} className="rounded-lg overflow-hidden border border-slate-200 bg-white">
              <button onClick={() => setExpanded(isOpen ? null : c.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="text-left">
                  <div className="font-semibold text-teal-900">{c.name}</div>
                  <div className="text-xs text-slate-400">
                    {c.registration_body} · {c.registration_no}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex gap-4 text-xs text-slate-500">
                    <span>
                      <span className="font-bold text-teal-800">{cdcCount}</span> CDC/CC issued
                    </span>
                    <span>
                      <span className="font-bold text-teal-800">{modCount}</span> modifications
                    </span>
                    <span>
                      <span className="font-bold text-teal-800">{ocCount}</span> OC issued
                    </span>
                    <span>
                      <span className="font-bold text-teal-800">{inspCount}</span> inspections{inspCount > 0 && ` (${inspPassed} passed, ${inspFailed} failed)`}
                    </span>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
              <div className="sm:hidden flex flex-wrap gap-2 px-5 pb-3 text-xs text-slate-500">
                <span>
                  <span className="font-bold text-teal-800">{cdcCount}</span> CDC/CC
                </span>
                <span>
                  <span className="font-bold text-teal-800">{modCount}</span> mods
                </span>
                <span>
                  <span className="font-bold text-teal-800">{ocCount}</span> OC
                </span>
                <span>
                  <span className="font-bold text-teal-800">{inspCount}</span> inspections
                </span>
              </div>
              {isOpen &&
                (own.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-400 border-t border-slate-100">No recorded activity yet.</div>
                ) : (
                  <div className="border-t border-slate-100">
                    {own.map((e, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3 border-t border-slate-100 first:border-t-0 text-sm">
                        <div>
                          <span className="text-slate-700">{e.action}</span>
                          <span className="text-slate-400"> — {e.address}</span>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap ml-3">{formatISODate(e.date)}</span>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          );
        })}
        {certifiers.length === 0 && <div className="text-sm text-slate-400">No certifiers yet — add one under Settings.</div>}
      </div>
    </div>
  );
}
