import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getIssuanceRegister, financialYearStart, REGISTER_COLUMNS } from "@/lib/issuanceRegister";
import { todayISO, formatISODate } from "@/lib/business";
import { PrintButton } from "@/components/PrintButton";
import Link from "next/link";

// The register as a document: firm name at the top, the period, the
// table — printed landscape so fourteen columns fit. Lives outside the
// app chrome so Print / Save as PDF captures only the register.
export default async function IssuanceRegisterDocumentPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const from = params.from || financialYearStart(todayISO());
  const to = params.to || todayISO();
  const [rows, { data: firm }] = await Promise.all([
    getIssuanceRegister(supabase, profile.firm_id, from, to),
    supabase.from("firms").select("name, abn").eq("id", profile.firm_id).single(),
  ]);

  return (
    <div className="min-h-screen bg-surface print:bg-white">
      <style>{`@page { size: A4 landscape; margin: 12mm; }`}</style>
      <div className="max-w-6xl mx-auto py-6 px-4 print:hidden flex items-center justify-between flex-wrap gap-2">
        <Link href={`/audit?section=register&from=${from}&to=${to}`} className="text-sm text-placeholder hover:text-primary">
          ← Back to audit
        </Link>
        <PrintButton label="Save as PDF" />
      </div>

      <div className="max-w-6xl mx-auto p-6 bg-white text-heading print:max-w-none print:p-0">
        <div className="flex justify-between items-baseline border-b border-heading pb-2 mb-4">
          <div>
            <div className="text-lg font-black tracking-tight">{firm?.name}</div>
            <div className="text-sm font-semibold">Certificate issuance register</div>
          </div>
          <div className="text-right text-xs text-muted">
            {firm?.abn && <div>ABN {firm.abn}</div>}
            <div>
              {formatISODate(from)} — {formatISODate(to)} · {rows.length} certificate{rows.length === 1 ? "" : "s"}
            </div>
            <div>Prepared {formatISODate(todayISO())}</div>
          </div>
        </div>

        <table className="w-full text-[10px] leading-snug">
          <thead>
            <tr className="text-left border-b-2 border-heading">
              {REGISTER_COLUMNS.map((c) => (
                <th key={c.key} className="pr-2 py-1 font-semibold align-bottom">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-line align-top">
                {REGISTER_COLUMNS.map((c) => (
                  <td key={c.key} className="pr-2 py-1">
                    {c.key === "date" ? formatISODate(row.date) : String(row[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={REGISTER_COLUMNS.length} className="py-6 text-center text-placeholder">
                  No certificates were issued in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
