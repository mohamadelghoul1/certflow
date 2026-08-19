import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { QUOTE_STATUS_META } from "@/lib/constants";

export default async function QuotesListPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, proposal_address, project_title, pathway, status")
    .eq("firm_id", profile.firm_id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-teal-900">Quotes</h1>
        <Link href="/quotes/new" className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
          + New quote
        </Link>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {(quotes || []).map((q) => {
          const meta = QUOTE_STATUS_META[q.status];
          return (
            <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between px-5 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
              <div>
                <div className="font-semibold text-sm text-teal-900">{q.proposal_address || q.project_title || "Untitled quote"}</div>
                <div className="text-xs text-slate-500">{q.pathway}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${meta.style}`}>{meta.label}</span>
            </Link>
          );
        })}
        {(quotes || []).length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400">No quotes yet.</div>}
      </div>
    </div>
  );
}
