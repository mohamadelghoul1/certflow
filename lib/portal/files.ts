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

// ePlanning's gateway only downloads documents from the inbound API
// endpoint registered for the organisation, shaped to their Get External
// Document contract: GET {registered base}/Documents/{DocID}, guarded by
// the Basic Auth credentials lodged at registration. These are the
// DocIDs — the same sealed naming of one storage path, but without an
// expiry: the gateway may fetch hours after the submission, and the
// Basic Auth wall is the standing gate.
export function eplanningDocId(storagePath: string): string {
  const payload = Buffer.from(JSON.stringify({ p: storagePath })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyEplanningDocId(docId: string): string | null {
  const [payload, signature] = docId.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { p?: string };
    return parsed.p || null;
  } catch {
    return null;
  }
}

// The URL a document is announced at, under the registered inbound base.
export function eplanningDocumentUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  return `${base}/api/eplanning/v1/office/Documents/${eplanningDocId(storagePath)}`;
}

// Whether the Basic Auth on an inbound ePlanning request matches the
// credentials lodged at registration (held in Vercel, never in code).
export function eplanningAuthOk(authorizationHeader: string | null): boolean {
  const username = process.env.EPLANNING_INBOUND_USERNAME || "";
  const password = process.env.EPLANNING_INBOUND_PASSWORD || "";
  if (!username || !password) return false;
  if (!authorizationHeader?.startsWith("Basic ")) return false;
  const presented = Buffer.from(authorizationHeader.slice(6), "base64");
  const expected = Buffer.from(`${username}:${password}`);
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}
