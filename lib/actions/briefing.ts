"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getComplianceItems } from "@/lib/compliance";
import { invoiceTotals, receivablesSummary } from "@/lib/invoices/invoiceLogic";
import { todayISO } from "@/lib/business";
import { aiConfigured, describeAiError } from "@/lib/ai/outstandingSummary";
import { buildBriefingFacts, factsHash, type BriefingJobRow } from "@/lib/assistant/briefingFacts";
import { askForBriefing, keepKnownJobs, standardBriefing, type Briefing } from "@/lib/assistant/briefing";

// The assistant's note for the dashboard.
//
// Written when the facts have changed and shown from the stored copy
// when they have not, so opening the dashboard ten times in a morning
// costs one call, not ten. A note is never more than a few minutes
// behind: a fresh upload changes the facts, and the next visit sees it.
// The Refresh button skips the wait for anyone who wants it now.

export type BriefingView = Briefing & {
  generatedAt: string;
  written: "ai" | "standard";
  // The facts moved since this was written, but it was written only
  // minutes ago — the page offers a refresh rather than paying again.
  changedSince: boolean;
  error?: string;
  setupNeeded?: string;
};

// Two notes inside this many minutes is a certifier reloading, not the
// day moving on.
const REWRITE_AFTER_MINUTES = 15;

type StoredRow = { headline: string; points: unknown; facts_hash: string; written: string; generated_at: string };

function isMissingTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205" || code === "PGRST106";
}

function fromStored(row: StoredRow, changedSince: boolean): BriefingView {
  const points = Array.isArray(row.points) ? (row.points as Briefing["points"]) : [];
  return { headline: row.headline, points, generatedAt: row.generated_at, written: row.written === "standard" ? "standard" : "ai", changedSince };
}

export async function loadBriefing(force: boolean): Promise<BriefingView> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const now = new Date();
  const today = todayISO();

  const [{ data: jobs }, compliance, { data: invoiceRows }, { data: invoiceLineRows }, { data: stored, error: storedError }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, address, pathway, checklists(kind, checklist_items(*, amendments(resolved), checklist_item_files(created_at, uploaded_by_role))), " +
          "inspections(id, title, date, outcome, booked_by_client, confirmed)"
      )
      .eq("firm_id", profile.firm_id)
      .eq("status", "active")
      .is("deleted_at", null),
    getComplianceItems(supabase, profile.firm_id, today),
    supabase.from("invoices").select("id, status, due_date").eq("firm_id", profile.firm_id),
    supabase.from("invoice_lines").select("invoice_id, amount"),
    supabase.from("ai_briefings").select("headline, points, facts_hash, written, generated_at").eq("firm_id", profile.firm_id).maybeSingle(),
  ]);

  const linesById = new Map<string, { amount: number }[]>();
  for (const line of invoiceLineRows || []) {
    const group = linesById.get(line.invoice_id) || [];
    group.push({ amount: line.amount });
    linesById.set(line.invoice_id, group);
  }
  const receivables =
    (invoiceRows || []).length > 0
      ? receivablesSummary(
          (invoiceRows || []).map((invoice) => ({ ...invoice, total: invoiceTotals(linesById.get(invoice.id) || []).total })),
          today
        )
      : null;

  const jobRows = (jobs || []) as unknown as BriefingJobRow[];
  const facts = buildBriefingFacts({ jobs: jobRows, compliance, receivables, now });
  const hash = factsHash(facts);
  const knownJobs = new Set(jobRows.map((j) => j.id));

  const row = (stored as StoredRow | null) || null;
  const tableMissing = isMissingTable(storedError?.code);

  if (row && !force) {
    if (row.facts_hash === hash) return fromStored(row, false);
    const ageMinutes = (now.getTime() - new Date(row.generated_at).getTime()) / 60000;
    if (ageMinutes < REWRITE_AFTER_MINUTES) return fromStored(row, true);
  }

  let briefing: Briefing;
  let written: BriefingView["written"];
  let error: string | undefined;
  if (aiConfigured()) {
    try {
      briefing = keepKnownJobs(await askForBriefing(facts, firstNameOf(profile.full_name, profile.email)), knownJobs);
      written = "ai";
    } catch (e) {
      // The facts still get read out — the model failing is not a
      // reason to show nothing.
      briefing = standardBriefing(facts);
      written = "standard";
      error = describeAiError(e);
    }
  } else {
    briefing = standardBriefing(facts);
    written = "standard";
  }

  const generatedAt = now.toISOString();
  if (!tableMissing && !error) {
    await supabase
      .from("ai_briefings")
      .upsert({ firm_id: profile.firm_id, headline: briefing.headline, points: briefing.points, facts_hash: hash, written, generated_at: generatedAt }, { onConflict: "firm_id" });
  }

  return {
    ...briefing,
    generatedAt,
    written,
    changedSince: false,
    error,
    setupNeeded: tableMissing ? "Run database update 0071 (Settings → System check) so the note is kept between visits." : !aiConfigured() ? "Add ANTHROPIC_API_KEY in Vercel for the AI to write this note." : undefined,
  };
}

function firstNameOf(fullName: string | null, email: string | null): string {
  return (fullName || email || "there").split(/[\s@]/)[0];
}
