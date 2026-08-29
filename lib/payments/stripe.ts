import { createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Card payments through Stripe, spoken to directly over its HTTPS API.
//
// No SDK: the three calls used here are plain form posts, and a
// dependency that large for three calls is how supply-chain risk
// arrives. The key never leaves the server.
//
// A payment link — rather than a checkout session — because an invoice
// is paid whenever the client gets to it, and checkout sessions expire
// in a day while payment links keep working.

const API = "https://api.stripe.com/v1";

// Whose Stripe account an invoice is paid into.
//
// This used to be one account for the whole deployment: whichever key
// sat in Vercel received everybody's money. Right for one firm, and
// wrong the moment there are two — a second firm's client would press
// "Pay online" and their payment would land in the first firm's bank
// account. So each firm connects its own Stripe, and the deployment's
// key is only the fallback for a firm that has not.
export type StripeCredentials = {
  secretKey: string | null;
  webhookSecret: string | null;
  // True when the money goes to the firm's own Stripe account rather
  // than the deployment's.
  ownAccount: boolean;
};

function deploymentCredentials(): StripeCredentials {
  return {
    secretKey: (process.env.STRIPE_SECRET_KEY || "").trim() || null,
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim() || null,
    ownAccount: false,
  };
}

// Whether this deployment has a Stripe account of its own configured.
// Only tells you what is in Vercel — a firm with its own account can
// take card payments whether or not this is set.
export function deploymentStripeConfigured(): boolean {
  return !!deploymentCredentials().secretKey;
}

// Which Stripe account this firm's invoices are paid into.
//
// Must be called with the service-role client: migration 0059 gives the
// credentials table no read policy at all, so nothing holding a login —
// certifier included — can select from it. That is deliberate. The
// Settings page hands the whole firms row to a Client Component, and a
// secret key on any table that page reads would be published in the
// page source.
//
// The two halves travel together: a firm on its own account is never
// given the deployment's webhook secret. That secret belongs to a
// different Stripe account, so it could not verify their events anyway,
// and pairing them would only make a real failure look like a signature
// problem.
export async function firmStripeCredentials(admin: SupabaseClient, firmId: string): Promise<StripeCredentials> {
  try {
    const { data } = await admin.from("firm_payment_credentials").select("*").eq("firm_id", firmId).maybeSingle();
    const row = data as { stripe_secret_key?: string | null; stripe_webhook_secret?: string | null } | null;
    const secretKey = (row?.stripe_secret_key || "").trim();
    if (secretKey) {
      return { secretKey, webhookSecret: (row?.stripe_webhook_secret || "").trim() || null, ownAccount: true };
    }
  } catch {
    // The table is not there yet — migration 0059 has not been run.
    // Falling through to the deployment's key keeps card payments
    // working exactly as they did before.
  }
  return deploymentCredentials();
}

// What Settings and the invoice page are allowed to know: whether each
// half is set, and when it last changed. Asked with the certifier's own
// session — the function behind it (migration 0059) returns booleans and
// never the keys, so nothing that reaches a browser could carry one.
export type StripeStatus = {
  secretKeySet: boolean;
  webhookSecretSet: boolean;
  updatedAt: string | null;
  // False until migration 0059 has been run against this database.
  installed: boolean;
};

export async function firmStripeStatus(supabase: SupabaseClient): Promise<StripeStatus> {
  const blank = { secretKeySet: false, webhookSecretSet: false, updatedAt: null };
  const { data, error } = await supabase.rpc("firm_stripe_status");
  if (error) return { ...blank, installed: false };
  const row = (data as { secret_key_set?: boolean; webhook_secret_set?: boolean; updated_at?: string }[] | null)?.[0];
  return {
    secretKeySet: row?.secret_key_set === true,
    webhookSecretSet: row?.webhook_secret_set === true,
    updatedAt: row?.updated_at || null,
    installed: true,
  };
}

// Whether to offer "Pay online" at all: this firm's own Stripe account
// if it has connected one, otherwise the deployment's.
export async function cardPaymentsAvailable(supabase: SupabaseClient): Promise<boolean> {
  const status = await firmStripeStatus(supabase);
  return status.secretKeySet || deploymentStripeConfigured();
}

async function stripePost(
  path: string,
  form: Record<string, string>,
  secretKey: string | null
): Promise<{ ok: boolean; body: Record<string, unknown>; error?: string }> {
  if (!secretKey) return { ok: false, body: {}, error: "Stripe is not connected" };
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(20000),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const err = (body.error as { message?: string } | undefined)?.message || `Stripe replied ${res.status}`;
      return { ok: false, body, error: err };
    }
    return { ok: true, body };
  } catch (err) {
    return { ok: false, body: {}, error: err instanceof Error ? err.message : String(err) };
  }
}

// Whole cents, rounded half-up the way the printed total is — the card
// amount must equal the invoice to the cent.
export function amountInCents(total: number): number {
  return Math.round(total * 100);
}

export async function createInvoicePaymentLink(opts: {
  invoiceId: string;
  invoiceNumber: string;
  reference: string | null;
  totalIncGst: number;
  secretKey: string | null;
}): Promise<{ linkId: string; url: string } | { error: string }> {
  const name = `Invoice ${opts.invoiceNumber}${opts.reference ? ` — ${opts.reference}` : ""}`;

  // Payment links take a saved price, so the price (with its product
  // inline) is created first. Both are single-purpose and named after
  // the invoice, so they read sensibly in the Stripe dashboard.
  const price = await stripePost(
    "/prices",
    {
      currency: "aud",
      unit_amount: String(amountInCents(opts.totalIncGst)),
      "product_data[name]": name,
    },
    opts.secretKey
  );
  if (!price.ok) return { error: price.error || "Could not create the Stripe price" };

  const link = await stripePost(
    "/payment_links",
    {
      "line_items[0][price]": String(price.body.id),
      "line_items[0][quantity]": "1",
      "metadata[certflow_invoice_id]": opts.invoiceId,
    },
    opts.secretKey
  );
  if (!link.ok) return { error: link.error || "Could not create the payment link" };
  return { linkId: String(link.body.id), url: String(link.body.url) };
}

// Once paid, the link is switched off so a client who bookmarks it
// cannot pay the same invoice twice. Best-effort: a failure here leaves
// a harmless live link, not a wrong invoice.
export async function deactivatePaymentLink(linkId: string, secretKey: string | null): Promise<void> {
  await stripePost(`/payment_links/${linkId}`, { active: "false" }, secretKey);
}

// Stripe signs each webhook body with the endpoint's own secret:
// "t=<unix>,v1=<hmac>". The signature proves the payload came from
// Stripe; the timestamp bounds how long a captured payload could be
// replayed.
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSeconds: number = Math.floor(Date.now() / 1000)): boolean {
  if (!header) return false;
  const parts = new Map(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 10 * 60) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return a.length === b.length && timingSafeEqual(a, b);
}
