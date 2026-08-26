"use client";

import { useState } from "react";
import { DateField } from "@/components/DateField";

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-xs font-semibold text-placeholder mb-1";

// The approval another certifier already issued, on a job where this firm
// is only the Principal Certifier through to the Occupation Certificate.
//
// It is the certificate the inspections are carried out under and the one
// the OC is issued against, so it is recorded here rather than left in a
// note: the OC documents print it by name. Whether it was a CDC or a CC
// decides what else is asked for — a CC sits on a development consent,
// which the OC documents also name, while a CDC is the consent itself.

export type PriorApprovalValue = { type?: "CDC" | "CC"; number?: string; date?: string; issuedBy?: string; portalRef?: string };

export function PriorApprovalFields({
  defaults,
  daNumber,
  daDate,
}: {
  defaults?: PriorApprovalValue;
  // The development consent fields live in certificateDetails and are
  // shared with CC jobs, so they are passed in rather than owned here.
  daNumber?: string;
  daDate?: string;
}) {
  const [type, setType] = useState<"CDC" | "CC">(defaults?.type || "CDC");

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted bg-surface border border-line rounded-md px-3 py-2">
        This job carries no certificate of its own. Record the approval already issued for the development — it is what the inspections are carried out under, and
        what the Occupation Certificate is issued against.
      </div>
      <div>
        <label className={labelCls}>What was already approved?</label>
        <div className="flex gap-2">
          {(["CDC", "CC"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-md text-sm font-semibold border ${type === t ? "bg-primary text-white border-primary" : "border-line text-muted hover:bg-hover"}`}
            >
              {t === "CDC" ? "Complying Development Certificate" : "Construction Certificate"}
            </button>
          ))}
        </div>
        <input type="hidden" name="priorApprovalType" value={type} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{type} number</label>
          <input name="priorApprovalNumber" defaultValue={defaults?.number || ""} placeholder={type === "CDC" ? "e.g. CDC-2026-114208" : "e.g. CFT-2026-208841"} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Date issued</label>
          <DateField name="priorApprovalDate" defaultValue={defaults?.date || ""} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Issued by</label>
        <input name="priorApprovalIssuedBy" defaultValue={defaults?.issuedBy || ""} placeholder="The certifier or council that issued it" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>NSW Planning Portal reference of the original {type}</label>
        <input
          name="priorApprovalPortalRef"
          defaultValue={defaults?.portalRef || ""}
          placeholder={type === "CDC" ? "e.g. CDC-331766" : "e.g. CFT-123456"}
          className={inputCls}
        />
        <p className="text-[11px] text-placeholder mt-1">
          The Portal case the original {type} was lodged under. It links this job to that case — inspections reported to the Portal are filed against it.
        </p>
      </div>
      {/* A construction certificate is granted under a development
          consent, and the OC names that consent too. A CDC is the consent,
          so these stay hidden for one. */}
      {type === "CC" && (
        <div className="grid sm:grid-cols-2 gap-4 border-t border-line pt-4">
          <div>
            <label className={labelCls}>Development Consent (DA) Number</label>
            <input name="developmentConsentNumber" defaultValue={daNumber || ""} placeholder="e.g. DA-25-01431" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Development Consent (DA) Date</label>
            <DateField name="developmentConsentDate" defaultValue={daDate || ""} className={inputCls} />
          </div>
        </div>
      )}
    </div>
  );
}
