import { headers } from "next/headers";

export const PRODUCTION_SITE_URL = "https://www.certlyn.com.au";

// Where this site actually is, asked of the request itself.
//
// Links mailed out (invites, password resets, portal links) used to be
// built from NEXT_PUBLIC_SITE_URL — one more setting to get wrong, and
// when it was wrong the links pointed at localhost with nothing to say
// so. The request already carries the host the visitor reached, and the
// proxy in front of it says which scheme, so the address can simply be
// read rather than configured. The environment variable stays as a
// fallback for contexts with no request (the nightly sweep).
export async function siteUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host && !host.startsWith("localhost")) {
      const proto = h.get("x-forwarded-proto") || "https";
      return `${proto}://${host}`;
    }
  } catch {
    // No request in scope — a scheduled run, say.
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && !configured.includes("localhost")) return configured;
  // Certlyn's own address, for the runs with no request to read it from.
  // Before this, the morning digest fell through to Vercel's address for
  // the deployment itself — certflow-ec026bec1-….vercel.app — and that is
  // what a client was sent as "your Certlyn portal". On Vercel that is
  // always this site; off Vercel (a laptop) the local address still wins.
  if (process.env.VERCEL) return PRODUCTION_SITE_URL;
  return configured || "http://localhost:3000";
}
