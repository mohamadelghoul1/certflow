import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeSignature, deactivatePaymentLink } from "@/lib/payments/stripe";
import { recordAuditEvent } from "@/lib/audit";
import { invoiceNumberOf } from "@/lib/invoices/invoiceLogic";
import { todayISO } from "@/lib/business";
import type { Invoice } from "@/types/db";

// Stripe calls this the moment a client's card payment succeeds, and the
// invoice marks itself paid — no morning of matching bank statements.
// The signature check is everything here: without it, anyone could POST
// "this invoice is paid".
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });

  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

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
  if (!invoice || invoice.status === "paid") return NextResponse.json({ received: true });

  await admin.from("invoices").update({ status: "paid", paid_date: todayISO(), updated_at: new Date().toISOString() }).eq("id", invoice.id);
  await recordAuditEvent(admin, {
    firmId: invoice.firm_id,
    action: "invoice.paid",
    summary: `Invoice ${invoiceNumberOf(invoice as Invoice)} paid by card`,
    jobId: invoice.job_id,
    jobAddress: invoice.reference,
    detail: { via: "stripe" },
  });
  await deactivatePaymentLink(paymentLinkId);

  return NextResponse.json({ received: true });
}
