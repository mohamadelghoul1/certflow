import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Excluded outright, because their callers hold no CertFlow login and
  // each carries its own proof instead: api/portal-files and
  // api/eplanning serve the NSW Planning Portal's downloader (sealed
  // token in the link / Basic Auth), api/cron is Vercel's scheduler
  // (CRON_SECRET header), api/stripe is Stripe's webhook (signed
  // payload), and api/client-error is a page reporting that it broke,
  // which is most worth hearing about precisely when it happens to
  // someone who is not signed in. Redirecting any of them to the login
  // page would silently break the feature behind it.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/portal-files/|api/eplanning/|api/cron/|api/stripe/|api/calendar/|api/client-error|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
