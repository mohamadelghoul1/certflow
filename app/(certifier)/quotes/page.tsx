import { pathwayLabel } from "@/lib/business";
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
        <h1 className="text-xl font-bold text-primary">Quotes</h1>
        <Link href="/quotes/new" className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
          + New quote
        </Link>
      </div>
      <div className="bg-white rounded-lg border border-line overflow-hidden">
        {(quotes || []).map((q) => {
          const meta = QUOTE_STATUS_META[q.status];
          return (
            <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between px-5 py-4 border-b border-line last:border-b-0 hover:bg-hover">
              <div>
                <div className="font-semibold text-sm text-primary">{q.proposal_address || q.project_title || "Untitled quote"}</div>
                <div className="text-xs text-placeholder">{pathwayLabel(q.pathway)}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${meta.style}`}>{meta.label}</span>
            </Link>
          );
        })}
        {(quotes || []).length === 0 && <div className="px-5 py-8 text-center text-sm text-placeholder">No quotes yet.</div>}
      </div>
    </div>
  );
}
