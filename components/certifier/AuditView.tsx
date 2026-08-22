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
      <h1 className="text-xl font-bold text-primary mb-1">Certifier Audit</h1>
      <p className="text-placeholder text-sm mb-6 max-w-2xl">
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
            <div key={c.id} className="rounded-lg overflow-hidden border border-line bg-white">
              <button onClick={() => setExpanded(isOpen ? null : c.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-hover transition-colors">
                <div className="text-left">
                  <div className="font-semibold text-primary">{c.name}</div>
                  <div className="text-xs text-placeholder">
                    {c.registration_body} · {c.registration_no}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex gap-4 text-xs text-placeholder">
                    <span>
                      <span className="font-bold text-primary">{cdcCount}</span> CDC/CC issued
                    </span>
                    <span>
                      <span className="font-bold text-primary">{modCount}</span> modifications
                    </span>
                    <span>
                      <span className="font-bold text-primary">{ocCount}</span> OC issued
                    </span>
                    <span>
                      <span className="font-bold text-primary">{inspCount}</span> inspections{inspCount > 0 && ` (${inspPassed} passed, ${inspFailed} failed)`}
                    </span>
                  </div>
                  <ChevronDown size={16} className={`text-placeholder transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
              <div className="sm:hidden flex flex-wrap gap-2 px-5 pb-3 text-xs text-placeholder">
                <span>
                  <span className="font-bold text-primary">{cdcCount}</span> CDC/CC
                </span>
                <span>
                  <span className="font-bold text-primary">{modCount}</span> mods
                </span>
                <span>
                  <span className="font-bold text-primary">{ocCount}</span> OC
                </span>
                <span>
                  <span className="font-bold text-primary">{inspCount}</span> inspections
                </span>
              </div>
              {isOpen &&
                (own.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-placeholder border-t border-line">No recorded activity yet.</div>
                ) : (
                  <div className="border-t border-line">
                    {own.map((e, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3 border-t border-line first:border-t-0 text-sm">
                        <div>
                          <span className="text-muted">{e.action}</span>
                          <span className="text-placeholder"> — {e.address}</span>
                        </div>
                        <span className="text-xs text-placeholder whitespace-nowrap ml-3">{formatISODate(e.date)}</span>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          );
        })}
        {certifiers.length === 0 && <div className="text-sm text-placeholder">No certifiers yet — add one under Settings.</div>}
      </div>
    </div>
  );
}
