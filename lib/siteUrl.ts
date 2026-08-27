import { headers } from "next/headers";

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
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return configured || "http://localhost:3000";
}
