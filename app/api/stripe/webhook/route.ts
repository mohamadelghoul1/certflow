import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeSignature, deactivatePaymentLink, firmStripeCredentials } from "@/lib/payments/stripe";
import { recordAuditEvent } from "@/lib/audit";
import { invoiceNumberOf } from "@/lib/invoices/invoiceLogic";
import { todayISO } from "@/lib/business";
import type { Invoice } from "@/types/db";

// Stripe calls this the moment a client's card payment succeeds, and the
// invoice marks itself paid — no morning of matching bank statements.
// The signature check is everything here: without it, anyone could POST
// "this invoice is paid".
//
// One URL, many Stripe accounts. Each firm adds this same address as a
// webhook in its own Stripe dashboard and gets its own signing secret,
// so which secret to check against depends on which firm the event
// belongs to. That is worked out from the payment link, which is
// created against exactly one firm's Stripe account and stored on
// exactly one invoice.
//
// So the body is parsed and the invoice looked up before the signature
// is checked. Reading is all that happens first: nothing is written, and
// nothing is said back that a forged payload could learn from. The
// signature is still what decides — and it is checked against the
// account that issued the link, so a caller holding one firm's secret
// cannot mark another firm's invoice paid.
export async function POST(request: NextRequest) {
  const payload = await request.text();

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  // Everything else Stripe sends is acknowledged and ignored — an
  // unhandled event must not look like a failure, or Stripe retries it
  // for days.
  if (event.type !== "checkout.session.completed") return NextResponse.json({ received: true });

  const session = event.data?.object || {};
  const paymentLinkId = typeof session.payment_link === "string" ? session.payment_link : null;
  if (!paymentLinkId || session.payment_status !== "paid") return NextResponse.json({ received: true });

  const admin = createAdminClient();
  const { data: invoice } = await admin.from("invoices").select("*").eq("stripe_payment_link_id", paymentLinkId).maybeSingle();
  // No invoice carries this link — it was deleted, or the event is for
  // something Certlyn did not create. Acknowledged rather than
  // refused: a 4xx here would have Stripe retrying a link that will
  // never exist for days.
  if (!invoice) return NextResponse.json({ received: true });

  const credentials = await firmStripeCredentials(admin, invoice.firm_id);
  // The firm takes card payments but has not given Certlyn the signing
  // secret, so nothing can be trusted yet. Refused rather than
  // acknowledged, so Stripe keeps retrying and the payment lands the
  // moment the secret is filled in on Settings → Payment details.
  if (!credentials.webhookSecret) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });

  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), credentials.webhookSecret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  if (invoice.status === "paid") return NextResponse.json({ received: true });

  await admin.from("invoices").update({ status: "paid", paid_date: todayISO(), updated_at: new Date().toISOString() }).eq("id", invoice.id);
  await recordAuditEvent(admin, {
    firmId: invoice.firm_id,
    action: "invoice.paid",
    summary: `Invoice ${invoiceNumberOf(invoice as Invoice)} paid by card`,
    jobId: invoice.job_id,
    jobAddress: invoice.reference,
    detail: { via: "stripe" },
  });
  await deactivatePaymentLink(paymentLinkId, credentials.secretKey);

  return NextResponse.json({ received: true });
}
