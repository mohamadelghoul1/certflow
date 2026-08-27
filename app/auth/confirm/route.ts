import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Where invite and password-reset links land.
//
// The links used to go through Supabase's own verify endpoint, which
// hands the session back as a URL fragment (#access_token=…). A browser
// never sends a fragment to the server, so this route saw nothing to
// exchange and bounced the visitor back to the sign-in page — the link
// looking broken when it was fine. Worse, that endpoint decides for
// itself where to send people, which is how a reset ended up at
// localhost even with the address configured correctly everywhere.
//
// So the emailed link now points straight here, carrying the one-time
// token as an ordinary query parameter this route can read and verify.
// Nothing in the middle gets to choose the destination.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/portal";
  const signInPage = next.startsWith("/portal") ? "/client-login" : "/login";

  if (!tokenHash || !type) return NextResponse.redirect(`${origin}${signInPage}?link=expired`);

  const supabase = await createClient();
  // A browser holds one session at a time: whoever the link belongs to
  // wins, rather than the certifier who happened to be signed in.
  await supabase.auth.signOut();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(`${origin}${signInPage}?link=expired`);

  return NextResponse.redirect(`${origin}${next}`);
}
