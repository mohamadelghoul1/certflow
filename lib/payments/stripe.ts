import { createHmac, timingSafeEqual } from "crypto";

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

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function stripeWebhookConfigured(): boolean {
  return !!process.env.STRIPE_WEBHOOK_SECRET;
}

async function stripePost(path: string, form: Record<string, string>): Promise<{ ok: boolean; body: Record<string, unknown>; error?: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, body: {}, error: "Stripe is not configured" };
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
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
}): Promise<{ linkId: string; url: string } | { error: string }> {
  const name = `Invoice ${opts.invoiceNumber}${opts.reference ? ` — ${opts.reference}` : ""}`;

  // Payment links take a saved price, so the price (with its product
  // inline) is created first. Both are single-purpose and named after
  // the invoice, so they read sensibly in the Stripe dashboard.
  const price = await stripePost("/prices", {
    currency: "aud",
    unit_amount: String(amountInCents(opts.totalIncGst)),
    "product_data[name]": name,
  });
  if (!price.ok) return { error: price.error || "Could not create the Stripe price" };

  const link = await stripePost("/payment_links", {
    "line_items[0][price]": String(price.body.id),
    "line_items[0][quantity]": "1",
    "metadata[certflow_invoice_id]": opts.invoiceId,
  });
  if (!link.ok) return { error: link.error || "Could not create the payment link" };
  return { linkId: String(link.body.id), url: String(link.body.url) };
}

// Once paid, the link is switched off so a client who bookmarks it
// cannot pay the same invoice twice. Best-effort: a failure here leaves
// a harmless live link, not a wrong invoice.
export async function deactivatePaymentLink(linkId: string): Promise<void> {
  await stripePost(`/payment_links/${linkId}`, { active: "false" });
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
