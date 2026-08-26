// Runs once at server start, before any request is handled — see
// lib/portal/fontsBoot.ts for why the fonts must be in place this early.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureFonts } = await import("@/lib/portal/fontsBoot");
    ensureFonts();
  }
}
