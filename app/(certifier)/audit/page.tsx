import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAuditEvents, getIssuanceEvents } from "@/lib/reporting";
import { getRecordedEvents } from "@/lib/audit";
import { AuditView } from "@/components/certifier/AuditView";
import { ReportsView } from "@/components/certifier/ReportsView";
import { getIssuanceRegister, financialYearStart, REGISTER_COLUMNS } from "@/lib/issuanceRegister";
import { todayISO, formatISODate } from "@/lib/business";
import Link from "next/link";
import { ClipboardList, BookMarked, BarChart3, Download, Printer, type LucideIcon } from "lucide-react";

// The audit area, split the same way Settings is: a menu of screens
// rather than one long page. Certifier activity keeps its existing view;
// the issuance register is the new screen — the formal record of every
// certificate issued in a chosen period, ready to hand to an insurer or
// Fair Trading.

const SECTIONS: { key: string; label: string; icon: LucideIcon; blurb: string }[] = [
  { key: "activity", label: "Certifier activity", icon: ClipboardList, blurb: "Everything each certifier has done, and the change log" },
  { key: "register", label: "Issuance register", icon: BookMarked, blurb: "Every CDC, CC and OC issued in a chosen period" },
  { key: "reports", label: "Issuance report", icon: BarChart3, blurb: "How many of each certificate, by month and year" },
];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ section?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const active = SECTIONS.find((s) => s.key === params.section) || SECTIONS[0];
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  let content: React.ReactNode = null;

  if (active.key === "activity") {
    const [events, log, { data: certifiers }] = await Promise.all([
      getAuditEvents(supabase, profile.firm_id),
      getRecordedEvents(supabase, profile.firm_id),
      supabase.from("certifiers").select("id, name, registration_no, registration_body").eq("firm_id", profile.firm_id).order("name"),
    ]);
    content = <AuditView certifiers={certifiers || []} events={events} log={log} />;
  } else if (active.key === "reports") {
    const events = await getIssuanceEvents(supabase, profile.firm_id);
    content = <ReportsView events={events.map((e) => ({ type: e.type, date: e.date.toISOString() }))} />;
  } else {
    const from = params.from || financialYearStart(todayISO());
    const to = params.to || todayISO();
    const rows = await getIssuanceRegister(supabase, profile.firm_id, from, to);
    const query = `from=${from}&to=${to}`;

    content = (
      <div>
        {/* Picking a period is an ordinary GET form: the dates live in
            the address bar, so a chosen register can be bookmarked and
            the export links below carry the same period. */}
        <form method="get" action="/audit" className="flex items-end gap-3 flex-wrap mb-4">
          <input type="hidden" name="section" value="register" />
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">From</label>
            <input type="date" name="from" defaultValue={from} className="px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">To</label>
            <input type="date" name="to" defaultValue={to} className="px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          <button className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">Show register</button>
          <span className="flex-1" />
          <a href={`/api/reports/issuance-register?${query}`} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-line text-sm text-primary font-medium hover:bg-hover">
            <Download size={14} /> Download for Excel
          </a>
          <Link href={`/audit/register?${query}`} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-line text-sm text-primary font-medium hover:bg-hover">
            <Printer size={14} /> Print / PDF
          </Link>
        </form>

        <div className="text-xs text-muted mb-3">
          {rows.length} certificate{rows.length === 1 ? "" : "s"} issued between {formatISODate(from)} and {formatISODate(to)}.
        </div>

        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-hover text-left">
                {REGISTER_COLUMNS.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-semibold text-primary border-b border-line">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-b-0 align-top">
                  {REGISTER_COLUMNS.map((c) => (
                    <td key={c.key} className={`px-3 py-2 ${c.key === "description" ? "whitespace-normal min-w-56" : ""}`}>
                      {c.key === "date" ? formatISODate(row.date) : String(row[c.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={REGISTER_COLUMNS.length} className="px-3 py-8 text-center text-placeholder">
                    No certificates were issued in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-placeholder mt-2">
          Blank cells mean the project&rsquo;s Details page doesn&rsquo;t hold that information yet — fill it there and the register picks it up.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-primary mb-6">Audit</h1>
      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-6 lg:items-start">
        <nav className="mb-5 lg:mb-0 flex gap-1 overflow-x-auto pb-1 lg:pb-0 lg:flex-col lg:overflow-visible" style={{ scrollbarWidth: "none" }}>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const current = s.key === active.key;
            return (
              <Link
                key={s.key}
                href={`/audit?section=${s.key}`}
                className={`flex items-center gap-2.5 shrink-0 rounded-md px-3 py-2 text-sm whitespace-nowrap ${
                  current ? "bg-primary text-white font-semibold" : "text-muted hover:bg-hover hover:text-primary"
                }`}
              >
                <Icon size={15} className={current ? "" : "text-icon"} />
                {s.label}
              </Link>
            );
          })}
        </nav>

        <section className="min-w-0">
          <div className="mb-4">
            <div className="font-bold text-primary">{active.label}</div>
            <div className="text-[11px] text-placeholder">{active.blurb}</div>
          </div>
          {content}
        </section>
      </div>
    </div>
  );
}
