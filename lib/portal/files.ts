import crypto from "node:crypto";

// Clean download links for the documents CertFlow hands the Portal.
//
// Storage's own signed links end in a long query string, and the
// Portal's document validation refused one. These links look like an
// ordinary file instead — /api/portal-files/<token>/inspection-record.jpg
// — with the authority carried in the signed token, not a query string.
// The token names the storage path and an expiry, sealed with a secret
// only the server holds, so the link serves exactly one file for a
// limited time and nothing else.

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function portalFileToken(storagePath: string, ttlSeconds = 3600): string {
  const payload = Buffer.from(JSON.stringify({ p: storagePath, e: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

// The storage path the token names, or null for anything tampered with
// or expired.
export function verifyPortalFileToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { p?: string; e?: number };
    if (!parsed.p || !parsed.e || parsed.e < Math.floor(Date.now() / 1000)) return null;
    return parsed.p;
  } catch {
    return null;
  }
}

export function portalFileUrl(storagePath: string, fileName: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  return `${base}/api/portal-files/${portalFileToken(storagePath)}/${encodeURIComponent(fileName)}`;
}
