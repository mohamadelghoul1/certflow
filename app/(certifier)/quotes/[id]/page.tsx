import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { QUOTE_STATUS_META } from "@/lib/constants";
import { addFeeLine, removeFeeLine, setQuoteStatus, markQuotePaid, generateJobFromQuote } from "@/lib/actions/quotes";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).eq("firm_id", profile.firm_id).single();
  if (!quote) notFound();
  const { data: lines } = await supabase.from("quote_fee_lines").select("*").eq("quote_id", id).order("sort_order");

  const total = (lines || []).reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const meta = QUOTE_STATUS_META[quote.status];
  const applicant = quote.applicant as { name?: string; email?: string; phone?: string };

  return (
    <div className="max-w-2xl">
      <Link href="/quotes" className="text-xs text-slate-400 hover:text-teal-800">
        ← All quotes
      </Link>
      <div className="flex items-center justify-between mt-1 mb-6">
        <h1 className="text-xl font-bold text-teal-900">{quote.proposal_address || "Untitled quote"}</h1>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${meta.style}`}>{meta.label}</span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-2 mb-6">
        <div className="text-sm text-slate-700">
          <span className="font-semibold">{quote.pathway}</span> · {quote.council_lga}
        </div>
        <div className="text-sm text-slate-600">{quote.development_description}</div>
        <div className="text-xs text-slate-400 mt-2">
          Applicant: {applicant?.name || "—"} {applicant?.email ? `· ${applicant.email}` : ""} {applicant?.phone ? `· ${applicant.phone}` : ""}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
        <div className="font-bold text-teal-900 mb-3">Fee schedule</div>
        <div className="space-y-2 mb-3">
          {(lines || []).map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
              <span className="text-slate-700">{l.description}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-900">${Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <form action={removeFeeLine}>
                  <input type="hidden" name="quote_id" value={id} />
                  <input type="hidden" name="line_id" value={l.id} />
                  <button className="text-xs text-red-500 hover:underline">Remove</button>
                </form>
              </div>
            </div>
          ))}
        </div>
        <form action={addFeeLine} className="flex gap-2 mb-3">
          <input type="hidden" name="quote_id" value={id} />
          <input name="description" placeholder="Line item" className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-sm" />
          <input name="amount" type="number" step="0.01" placeholder="Amount" className="w-32 px-2 py-1.5 rounded border border-slate-200 text-sm" />
          <button className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900">Add</button>
        </form>
        <div className="text-right text-sm font-bold text-teal-900">Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
        <div className="font-bold text-teal-900">Status</div>
        <div className="flex flex-wrap gap-2">
          {["draft", "sent", "accepted", "declined"].map((s) => (
            <form action={setQuoteStatus} key={s}>
              <input type="hidden" name="quote_id" value={id} />
              <input type="hidden" name="status" value={s} />
              <button className={`px-3 py-1.5 rounded-md text-xs font-semibold ${quote.status === s ? "bg-teal-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                Mark {s}
              </button>
            </form>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <span className="text-sm text-slate-600">
            Payment: <span className="font-semibold">{quote.payment_status === "paid" ? "Paid" : "Unpaid"}</span>
          </span>
          {quote.payment_status !== "paid" && (
            <form action={markQuotePaid}>
              <input type="hidden" name="quote_id" value={id} />
              <button className="text-xs text-teal-800 hover:underline">Mark as paid</button>
            </form>
          )}
        </div>

        {quote.status === "accepted" && !quote.linked_job_id && (
          <form action={generateJobFromQuote} className="pt-2 border-t border-slate-100">
            <input type="hidden" name="quote_id" value={id} />
            <button className="px-4 py-2 rounded-md bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800">Generate job from quote</button>
          </form>
        )}
        {quote.linked_job_id && (
          <Link href={`/jobs/${quote.linked_job_id}`} className="inline-block text-sm text-teal-800 font-semibold hover:underline pt-2 border-t border-slate-100">
            View linked job →
          </Link>
        )}
      </div>
    </div>
  );
}
