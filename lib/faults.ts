import type { SupabaseClient } from "@supabase/supabase-js";

// Reading the fault log for the Faults page.
//
// Kept apart from lib/errorLog.ts on purpose: that side writes with the
// service key and must never fail, this side reads as the signed-in
// certifier and is allowed to.

export type FaultRow = {
  id: string;
  source: "server" | "browser";
  route: string | null;
  method: string | null;
  route_type: string | null;
  message: string;
  digest: string | null;
  stack: string | null;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
};

// Open faults first, each group newest-first: what is still broken is
// what the page is for.
export function sortFaults(faults: FaultRow[]): FaultRow[] {
  return [...faults].sort((a, b) => {
    const aOpen = a.resolved_at ? 1 : 0;
    const bOpen = b.resolved_at ? 1 : 0;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return b.last_seen_at.localeCompare(a.last_seen_at);
  });
}

// How loudly a fault should read. Something happening over and over is a
// different problem from something that happened once a fortnight ago,
// even when the message is identical.
export function faultTone(fault: Pick<FaultRow, "occurrences" | "resolved_at">): "handled" | "repeating" | "open" {
  if (fault.resolved_at) return "handled";
  return fault.occurrences >= 5 ? "repeating" : "open";
}

export async function getFaults(supabase: SupabaseClient, limit = 100): Promise<{ faults: FaultRow[]; ready: boolean }> {
  const { data, error } = await supabase.from("error_events").select("*").order("last_seen_at", { ascending: false }).limit(limit);
  // A database still to have migration 0047 run against it says so on
  // the page rather than looking like a firm with no faults.
  if (error) return { faults: [], ready: false };
  return { faults: sortFaults((data || []) as FaultRow[]), ready: true };
}
