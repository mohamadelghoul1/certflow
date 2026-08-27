"use client";

import { useState } from "react";
import type { Contractor } from "@/types/db";

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-xs font-semibold text-placeholder mb-1";

// The principal contractor, in full — and the firm's builders list.
//
// The same handful of builders turn up across a certifier's projects,
// so the block starts with a picker over the saved list: choosing one
// fills every box. Ticking "save" when the job is saved puts a new
// builder on the list for next time. All of it optional — a job created
// before the builder is appointed simply leaves it blank.
export function ContractorFields({
  defaults,
  saved,
}: {
  defaults?: { company?: string; name?: string; phone?: string; email?: string; licenceNo?: string };
  saved: Contractor[];
}) {
  const [fields, setFields] = useState({
    company: defaults?.company || "",
    name: defaults?.name || "",
    phone: defaults?.phone || "",
    email: defaults?.email || "",
    licenceNo: defaults?.licenceNo || "",
  });
  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div>
      <label className={labelCls}>Principal contractor / builder</label>

      {saved.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const pick = saved.find((c) => c.id === e.target.value);
            if (pick) setFields({ company: pick.company, name: pick.name, phone: pick.phone, email: pick.email, licenceNo: pick.licence_no });
          }}
          className={`${inputCls} mb-2`}
        >
          <option value="">— pick from your saved builders —</option>
          {saved.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.company, c.name].filter(Boolean).join(" — ")}
              {c.licence_no ? ` (Lic. ${c.licence_no})` : ""}
            </option>
          ))}
        </select>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        <input name="contractor_company" value={fields.company} onChange={set("company")} placeholder="Company" className={inputCls} />
        <input name="contractor_name" value={fields.name} onChange={set("name")} placeholder="Contractor's full name" className={inputCls} />
        <input name="contractor_phone" value={fields.phone} onChange={set("phone")} placeholder="Phone" className={inputCls} />
        <input type="email" name="contractor_email" value={fields.email} onChange={set("email")} placeholder="Email" className={inputCls} />
        <input name="contractor_licenceNo" value={fields.licenceNo} onChange={set("licenceNo")} placeholder="Licence number" className={inputCls} />
      </div>

      <label className="flex items-center gap-2 text-sm text-muted mt-2">
        <input type="checkbox" name="contractor_save" className="accent-icon" />
        Save this builder to my list for future projects
      </label>
    </div>
  );
}
