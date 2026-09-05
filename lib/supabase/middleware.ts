import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/client-login");
  const isClientRoute = path.startsWith("/portal");
  // /auth/* is where emailed links land: the visitor has no session yet —
  // the link's one-time token IS their proof, and the route verifies it
  // itself. Bouncing them to the sign-in page here would eat the link.
  // The public pages a certifier reads before they have a login.
  const isMarketingRoute = path === "/how-it-works" || path === "/why-certlyn" || path === "/join" || path === "/pricing" || path === "/privacy" || path === "/terms";
  // The monitoring endpoint answers to anyone, because a monitor has no
  // login and the whole point is that it still answers when the rest of
  // the app cannot. It says nothing but whether the database replied.
  const isPublicRoute = path === "/" || isAuthRoute || isMarketingRoute || path.startsWith("/auth/") || path === "/api/health";

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = isClientRoute ? "/client-login" : "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
