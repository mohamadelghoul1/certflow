import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildIcs, type CalendarEvent } from "@/lib/calendar/ics";
import { formatISODate } from "@/lib/business";
import { INSPECTION_OUTCOME_TEXT } from "@/lib/constants";

// The inspection diary, as a calendar a phone can subscribe to.
//
// No session and no cookie: a calendar app fetches this URL forever with
// nothing but the URL itself, so the token in the path is the whole
// credential. It is looked up through a security-definer function that
// answers with one firm and nothing else, so a guessed token reads
// nothing rather than reading somebody's diary.
//
// Signed out by design, which is why it sits in the proxy's exclusion
// list beside the other unauthenticated routes.

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Checked before it reaches the database: the column is a uuid, and a
  // malformed one would be a type error rather than a clean miss.
  if (!UUID.test(token)) return new NextResponse("Not found.", { status: 404 });

  const admin = createAdminClient();
  const { data: holder } = await admin.rpc("certifier_for_calendar_token", { p_token: token }).maybeSingle();
  const owner = holder as { certifier_id: string; firm_id: string; name: string } | null;
  if (!owner) return new NextResponse("Not found.", { status: 404 });

  // Everything still to come, plus the recent past — a diary that
  // forgets last week is a diary that cannot show what was attended.
  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data } = await admin
    .from("inspections")
    .select("id, title, date, outcome, confirmed, booked_by_client, jobs!inner(address, firm_id, deleted_at)")
    .gte("date", from)
    .order("date");

  const rows = ((data || []) as unknown as {
    id: string;
    title: string;
    date: string | null;
    outcome: string;
    confirmed: boolean;
    booked_by_client: boolean;
    jobs: { address: string; firm_id: string; deleted_at: string | null } | null;
  }[]).filter((row) => row.jobs && row.jobs.firm_id === owner.firm_id && !row.jobs.deleted_at && row.date);

  const origin = new URL(request.url).origin;
  const events: CalendarEvent[] = rows.map((row) => ({
    // Tied to the row, so an inspection moved to another day moves in
    // the subscriber's calendar instead of appearing twice.
    uid: `inspection-${row.id}@certflow`,
    date: row.date!,
    summary: `${row.title} — ${row.jobs!.address}`,
    location: row.jobs!.address,
    description: [
      `Outcome: ${INSPECTION_OUTCOME_TEXT[row.outcome] || row.outcome}`,
      row.booked_by_client && !row.confirmed ? "Booked by the client and not yet confirmed." : "",
      `Date booked: ${formatISODate(row.date!)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    url: `${origin}/site/${row.id}`,
  }));

  return new NextResponse(buildIcs(events, `Inspections — ${owner.name}`), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Never cached: an inspection booked this morning for tomorrow has
      // to reach the phone on its next refresh, not after a CDN expiry.
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": 'inline; filename="certflow-inspections.ics"',
    },
  });
}
