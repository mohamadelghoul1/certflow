import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { QUOTE_STATUS_META } from "@/lib/constants";
import { setQuoteStatus, markQuotePaid, generateJobFromQuote } from "@/lib/actions/quotes";
import { QuoteEditForm } from "@/components/certifier/QuoteEditForm";
import { Check } from "lucide-react";
import type { Quote, QuoteFeeLine } from "@/types/db";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const [{ data: rawQuote }, { data: lines }, { data: certifiers }, { data: clients }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).eq("firm_id", profile.firm_id).single(),
    supabase.from("quote_fee_lines").select("*").eq("quote_id", id).order("sort_order"),
    supabase.from("certifiers").select("id, name").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("clients").select("id, name, type").eq("firm_id", profile.firm_id).order("name"),
  ]);
  if (!rawQuote) notFound();
  const quote = rawQuote as Quote;
  const meta = QUOTE_STATUS_META[quote.status];

  return (
    <div className="max-w-2xl">
      <Link href="/quotes" className="text-xs text-placeholder hover:text-primary">
        ← All quotes
      </Link>
      <div className="flex items-center justify-between mt-1 mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-primary">{quote.proposal_address || "Untitled quote"}</h1>
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${meta.style}`}>{meta.label}</span>
          {quote.status !== "draft" && (
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${quote.payment_status === "paid" ? "bg-success-bg text-success" : "bg-warning-bg text-warning-text"}`}>
              {quote.payment_status === "paid" ? `Paid ${quote.payment_received_date || ""}` : "Unpaid"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/quotes/${id}/document`} className="px-3.5 py-2 rounded-md border border-line text-sm text-primary font-medium hover:bg-hover">
            View quote
          </Link>
          {quote.status === "draft" && (
            <form action={setQuoteStatus}>
              <input type="hidden" name="quote_id" value={id} />
              <input type="hidden" name="status" value="sent" />
              <button className="px-3.5 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">Issue quote to client</button>
            </form>
          )}
          {quote.status === "sent" && (
            <>
              <form action={setQuoteStatus}>
                <input type="hidden" name="quote_id" value={id} />
                <input type="hidden" name="status" value="declined" />
                <button className="px-3.5 py-2 rounded-md border border-error/40 text-sm text-error font-medium hover:bg-error-bg">Mark declined</button>
              </form>
              <form action={setQuoteStatus}>
                <input type="hidden" name="quote_id" value={id} />
                <input type="hidden" name="status" value="accepted" />
                <button className="px-3.5 py-2 rounded-md border border-success/40 text-sm text-success font-medium hover:bg-success-bg">Mark accepted</button>
              </form>
            </>
          )}
          {quote.status === "accepted" && !quote.linked_job_id && (
            <form action={generateJobFromQuote}>
              <input type="hidden" name="quote_id" value={id} />
              <button className="px-3.5 py-2 rounded-md bg-success text-white text-sm font-semibold hover:bg-success">Generate project from quote</button>
            </form>
          )}
          {quote.status !== "draft" && quote.payment_status !== "paid" && (
            <form action={markQuotePaid}>
              <input type="hidden" name="quote_id" value={id} />
              <button className="px-3.5 py-2 rounded-md border border-success/40 text-sm text-success font-medium hover:bg-success-bg">Mark as paid</button>
            </form>
          )}
          {quote.linked_job_id && (
            <Link href={`/jobs/${quote.linked_job_id}?tab=pathway`} className="flex items-center gap-1.5 px-3 py-2 text-sm text-success font-medium hover:underline">
              <Check size={14} /> View project
            </Link>
          )}
        </div>
      </div>

      <QuoteEditForm quote={quote} feeLines={(lines || []) as QuoteFeeLine[]} certifiers={certifiers || []} clients={clients || []} />
    </div>
  );
}
