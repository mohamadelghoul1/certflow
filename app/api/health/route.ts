import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Is Certlyn actually working?
//
// Not "did a page render" — a monitoring service pinging the homepage
// would have found it healthy while the database was unreachable and
// nobody could sign in. This asks the database a real question, which
// is the failure that matters: no database, no logins, no projects, no
// documents.
//
// Deliberately says nothing about the firms on it. Anyone on the
// internet can reach this, so it answers with a status code and a word,
// and never with a count of anything.
export const dynamic = "force-dynamic";

// A database that has stopped answering is as bad as one that refuses,
// and a monitor left hanging reports neither. Five seconds is far
// longer than a healthy answer takes and far shorter than any sensible
// monitor's own timeout.
const TIMEOUT_MS = 5000;

export async function GET() {
  const startedAt = Date.now();
  let database: "ok" | "down" = "down";
  let detail: string | null = null;
  const giveUp = AbortSignal.timeout(TIMEOUT_MS);

  try {
    const supabase = await createClient();
    // A count with no rows returned: the smallest question that still
    // proves the connection, the credentials and row security are all
    // working. Anonymous, so it goes through exactly the path a visitor
    // arriving at the sign-in page takes.
    const { error } = await supabase.from("firms").select("id", { count: "exact", head: true }).limit(1).abortSignal(giveUp);
    if (error) detail = error.message;
    else database = "ok";
  } catch (err) {
    detail = giveUp.aborted ? `no answer within ${TIMEOUT_MS} ms` : err instanceof Error ? err.message : "unreachable";
  }

  const healthy = database === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      // What the check itself took, so a monitor can watch the database
      // getting slow before it stops answering altogether.
      ms: Date.now() - startedAt,
      // Only ever a database driver's own message, never anything about
      // a firm or its data.
      detail: healthy ? undefined : detail,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
