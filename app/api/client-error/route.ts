import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordError, shortMessage } from "@/lib/errorLog";
import { withinLimit } from "@/lib/rateLimit";
import { siteUrl } from "@/lib/siteUrl";

// Where the screen reports a failure the server never saw — a page that
// broke while it was running in someone's browser.
//
// Deliberately open to anyone: a crash on the login page has no session
// to prove, and that is exactly the failure worth hearing about. What
// keeps it honest is the ceiling below and the fact that nothing here is
// trusted — every value is truncated by the database function, and a
// report only ever adds a row to a table nobody but a certifier can
// read.
const REPORT_LIMIT = { windowSeconds: 3600, max: 30 };

export async function POST(request: NextRequest) {
  let body: { message?: unknown; digest?: unknown; path?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Counted per person when we know who they are, and per address when
  // we don't, so one broken browser cannot drown out everyone else's.
  const who = user?.id || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!(await withinLimit(supabase, `client-error:${who}`, REPORT_LIMIT))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const { data: profile } = user ? await supabase.from("profiles").select("firm_id").eq("id", user.id).maybeSingle() : { data: null };

  await recordError(
    {
      source: "browser",
      message: shortMessage(String(body.message || "Unknown error"), 500),
      digest: typeof body.digest === "string" ? body.digest : null,
      route: typeof body.path === "string" ? body.path : null,
      firmId: (profile as { firm_id?: string } | null)?.firm_id ?? null,
      userId: user?.id ?? null,
    },
    await siteUrl()
  );

  return NextResponse.json({ ok: true });
}
