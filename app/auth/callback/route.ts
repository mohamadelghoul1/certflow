import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// Handles the link Supabase emails out for invites and password resets:
// it carries a one-time `code`, which is exchanged for a real session,
// and the browser then goes wherever the link said.
//
// Two things this has to get right, both learned the hard way:
//
// A browser holds one session at a time. Opening a client's invite while
// signed in as the certifier used to leave the old session in place and
// land back in the certifier's app, looking like the link had failed.
// Whoever the link belongs to wins, so any existing session is dropped
// before the code is exchanged.
//
// And an exchange can fail — a link already used, or expired. That must
// say so on the sign-in page rather than redirecting into a portal the
// visitor has no session for, which reads as a broken link.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/portal";
  const signInPage = next.startsWith("/portal") ? "/client-login" : "/login";

  if (!code) return NextResponse.redirect(`${origin}${signInPage}`);

  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}${signInPage}?link=expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
