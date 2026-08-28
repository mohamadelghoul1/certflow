import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailConfigured } from "@/lib/email";
import { escapeHtml } from "@/lib/html";

// The app noticing its own failures.
//
// Before this, a failure was known only to the person it happened to.
// They saw a broken page; the server wrote a line to a log nobody reads;
// unless they thought to report it, nothing else knew. A firm relying on
// this software should not be its only fault detector.
//
// Every rule here bends the same way: reporting a fault must never cause
// one. Nothing in this file throws, and everything it needs is optional.

export type ErrorSource = "server" | "browser";

export type ErrorReport = {
  source: ErrorSource;
  message: string;
  route?: string | null;
  method?: string | null;
  routeType?: string | null;
  digest?: string | null;
  stack?: string | null;
  firmId?: string | null;
  userId?: string | null;
};

// What makes two failures the same failure.
//
// The same fault rarely produces the same words twice: the ids, dates
// and file paths inside a message are what differ between one occurrence
// and the next. Stripping those before grouping is the difference
// between "one page is broken" and four hundred rows saying so.
export function normaliseMessage(message: string): string {
  return (message || "")
    .toLowerCase()
    // uuids, then long hex (digests, tokens), then any run of digits
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/\b[0-9a-f]{12,}\b/g, "<id>")
    .replace(/\d+/g, "<n>")
    // quoted values — a file name, an address, a client's name
    .replace(/"[^"]*"/g, '"…"')
    .replace(/'[^']*'/g, "'…'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

// A route with its ids removed, so /jobs/<uuid> and /jobs/<other uuid>
// are one page rather than two faults.
export function normaliseRoute(route: string | null | undefined): string {
  return (route || "")
    .split("?")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:n")
    .slice(0, 300);
}

export function fingerprintFor(report: Pick<ErrorReport, "source" | "message" | "route" | "digest">): string {
  // The digest, when React gives us one, is the most reliable identity
  // there is — it is derived from the error itself. Otherwise the page
  // and the shape of the message.
  const basis = report.digest ? `${report.source}|digest:${report.digest}` : `${report.source}|${normaliseRoute(report.route)}|${normaliseMessage(report.message)}`;
  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

// The first line of what went wrong, for a subject line or a list.
export function shortMessage(message: string, limit = 140): string {
  const line = (message || "Unknown error").split("\n")[0].trim();
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line || "Unknown error";
}

function alertHtml(report: ErrorReport, siteUrl: string): string {
  const rows: [string, string][] = [
    ["What", shortMessage(report.message, 300)],
    ["Where", report.route || "—"],
    ["Kind", report.source === "browser" ? "Failed in someone's browser" : `Failed on the server${report.routeType ? ` (${report.routeType})` : ""}`],
  ];
  return [
    `<p>Something in CertFlow failed for the first time. It has been recorded — this is not a copy of an old problem.</p>`,
    `<table style="border-collapse:collapse;font-size:14px">`,
    ...rows.map(([label, value]) => `<tr><td style="padding:4px 14px 4px 0;font-weight:bold;vertical-align:top">${label}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`),
    `</table>`,
    `<p>The full details, and every other fault, are on the <a href="${siteUrl}/audit?section=faults">Faults page</a> under Audit.</p>`,
    `<p style="color:#666;font-size:12px">You are told once per fault, however many times it happens. If the same fault returns after you mark it handled, you will hear again.</p>`,
  ].join("");
}

// Records a failure, and emails once — the first time a given fault is
// seen. The hundredth occurrence of a known problem is not news.
//
// Never throws. A database without migration 0047, a missing service
// key, an email that will not send: all of them end here quietly, having
// at least written the failure to the server log.
export async function recordError(report: ErrorReport, siteUrl?: string): Promise<void> {
  try {
    console.error(`[certflow] ${report.source} error at ${report.route || "unknown"}:`, report.message);

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("record_error_event", {
      p_fingerprint: fingerprintFor(report),
      p_firm_id: report.firmId ?? null,
      p_source: report.source,
      p_route: report.route ?? null,
      p_method: report.method ?? null,
      p_route_type: report.routeType ?? null,
      p_message: report.message,
      p_digest: report.digest ?? null,
      p_stack: report.stack ?? null,
      p_user_id: report.userId ?? null,
    });
    if (error || data !== true) return;

    // First sighting. Tell someone, if there is anyone to tell.
    const recipient = await alertRecipient(report.firmId ?? null);
    if (!recipient || !emailConfigured()) return;
    await sendEmail(recipient, `CertFlow problem: ${shortMessage(report.message, 80)}`, alertHtml(report, siteUrl || ""));
  } catch (err) {
    console.error("[certflow] could not record the error above", err);
  }
}

// Where a fault alert goes: the address set for it in Vercel, or the
// firm's own. A fault with no firm attached — a failure on the login
// page — has only the configured address, which is why it is worth
// setting.
async function alertRecipient(firmId: string | null): Promise<string | null> {
  const configured = (process.env.ERROR_ALERT_EMAIL || "").trim();
  if (configured) return configured;
  if (!firmId) return null;
  try {
    const { data } = await createAdminClient().from("firms").select("email").eq("id", firmId).maybeSingle();
    return (data as { email?: string | null } | null)?.email?.trim() || null;
  } catch {
    return null;
  }
}
