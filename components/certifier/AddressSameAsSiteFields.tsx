"use client";

import { useState } from "react";
import { NSW_STATE } from "@/lib/constants";

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-xs font-semibold text-placeholder mb-1";

// An address that is usually the site itself — the applicant is building
// at home, and the owner lives there.
//
// Ticking the box means it is never recorded twice: the address is taken
// from the property address when the job is saved, and taken again on
// every later save, so correcting the site corrects both. Untick it and
// the fields come back with whatever was last recorded.
//
// Shared by the applicant's address and the owner's, which differ only
// in what their boxes are called.
export function AddressSameAsSiteFields({
  label,
  prefix,
  sameName,
  defaults,
  defaultSameAsSite,
  required,
}: {
  label: string;
  prefix: string;
  sameName: string;
  defaults?: { streetNumber?: string; street?: string; suburb?: string; state?: string; postcode?: string };
  defaultSameAsSite?: boolean;
  required?: boolean;
}) {
  const [sameAsSite, setSameAsSite] = useState(!!defaultSameAsSite);

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <label className="flex items-center gap-2 text-sm text-muted mb-2">
        <input type="checkbox" name={sameName} checked={sameAsSite} onChange={(e) => setSameAsSite(e.target.checked)} className="accent-icon" />
        Same as the property address
      </label>

      {sameAsSite ? (
        <p className="text-[11px] text-placeholder">
          Taken from the property address when this is saved, and kept in step with it afterwards — there is nothing to type here.
        </p>
      ) : (
        <>
          <div className="grid sm:grid-cols-5 gap-2">
            <input name={`${prefix}_streetNumber`} required={required} defaultValue={defaults?.streetNumber || ""} placeholder="No." className={inputCls} />
            <input name={`${prefix}_street`} required={required} defaultValue={defaults?.street || ""} placeholder="Street" className={`${inputCls} sm:col-span-2`} />
            <input name={`${prefix}_suburb`} required={required} defaultValue={defaults?.suburb || ""} placeholder="Suburb" className={inputCls} />
            <input name={`${prefix}_postcode`} required={required} defaultValue={defaults?.postcode || ""} placeholder="Postcode" className={inputCls} />
          </div>
          <select name={`${prefix}_state`} defaultValue={defaults?.state || "NSW"} className={`${inputCls} mt-2 sm:w-40`}>
            {NSW_STATE.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
