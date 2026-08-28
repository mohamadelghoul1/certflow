import type { Instrumentation } from "next";

// Runs once at server start, before any request is handled — see
// lib/portal/fontsBoot.ts for why the fonts must be in place this early.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureFonts } = await import("@/lib/portal/fontsBoot");
    ensureFonts();
  }
}

// Every failure the server catches, from any page, action or route,
// passes through here. This is the whole reason a fault reaches anyone
// at all: without it, a page that breaks for a certifier on a Tuesday is
// known only to that certifier.
//
// The error React hands over may not be the one that was thrown — it
// replaces the message in production and leaves a digest instead, which
// is why the digest is recorded and used for grouping when present.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // The Edge runtime has no service key and no crypto the recorder uses;
  // those failures still reach the platform log.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { recordError } = await import("@/lib/errorLog");
  const error = err as { message?: string; stack?: string; digest?: unknown };

  await recordError({
    source: "server",
    message: error?.message || String(err),
    stack: error?.stack || null,
    digest: typeof error?.digest === "string" ? error.digest : null,
    route: request.path,
    method: request.method,
    routeType: context.routeType,
  });
};
