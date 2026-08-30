"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayISO } from "@/lib/business";
import { firmSender, sendEmail, firmEmailConfigured } from "@/lib/email";
import { recordAuditEvent } from "@/lib/audit";
import { invoiceTotals, invoiceNumberOf, nextInvoiceNumber, formatMoney } from "@/lib/invoices/invoiceLogic";
import { firmStripeCredentials, createInvoicePaymentLink } from "@/lib/payments/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { cardSurchargeFor } from "@/lib/payments/surcharge";
import type { ActionState } from "@/lib/actions/auth";
import type { Invoice, InvoiceLine } from "@/types/db";
import { escapeHtml } from "@/lib/html";
import { buildInvoiceFile } from "@/lib/invoices/invoiceDocument";
import { invoiceEmailHtml } from "@/lib/invoices/invoiceEmail";
import { siteUrl } from "@/lib/siteUrl";

// Due in 14 days unless the certifier says otherwise — the trade
// standard, and always visible and editable on the draft before it goes.
function defaultDueDate(issueDate: string): string {
  const due = new Date(`${issueDate}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + 14);
  return due.toISOString().slice(0, 10);
}

async function nextNumberForFirm(supabase: Awaited<ReturnType<typeof createClient>>, firmId: string): Promise<string> {
  const { data } = await supabase.from("invoices").select("invoice_number").eq("firm_id", firmId);
  return nextInvoiceNumber((data || []).map((row) => row.invoice_number));
}

// A new invoice starts as a draft and opens straight in the editor —
// from a quote (carrying its fee lines, client and address), from a job
// (carrying its client and address; the fees are typed), or blank.
export async function createInvoice(formData: FormData): Promise<void> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id") || "");
  const jobId = String(formData.get("job_id") || "");

  // The firm's standing bank details, copied onto the invoice so it
  // keeps forever what it actually went out with. Fetched tolerantly: a
  // database without migration 0035 simply contributes nothing.
  const { data: firmRow } = await supabase.from("firms").select("payment_details").eq("id", profile.firm_id).maybeSingle();
  const firmPaymentDetails = (firmRow as { payment_details?: string | null } | null)?.payment_details || null;

  const issueDate = todayISO();
  const invoice: Record<string, unknown> = {
    payment_details: firmPaymentDetails,
    firm_id: profile.firm_id,
    status: "draft",
    issue_date: issueDate,
    due_date: defaultDueDate(issueDate),
    invoice_number: await nextNumberForFirm(supabase, profile.firm_id),
  };
  let feeLines: { description: string; quantity: string; amount: number; sort_order: number }[] = [];

  if (quoteId) {
    const [{ data: quote }, { data: lines }] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", quoteId).eq("firm_id", profile.firm_id).single(),
      supabase.from("quote_fee_lines").select("*").eq("quote_id", quoteId).order("sort_order"),
    ]);
    if (quote) {
      const applicant = (quote.applicant || {}) as { name?: string };
      invoice.quote_id = quoteId;
      invoice.job_id = quote.linked_job_id || null;
      invoice.client_id = quote.client_id;
      invoice.reference = quote.proposal_address || quote.project_title || null;
      invoice.bill_to = applicant.name || null;
      feeLines = (lines || []).map((l, i) => ({ description: l.description, quantity: l.quantity || "1", amount: Number(l.amount) || 0, sort_order: i }));
    }
  } else if (jobId) {
    const { data: job } = await supabase.from("jobs").select("id, address, client_id, details").eq("id", jobId).eq("firm_id", profile.firm_id).single();
    if (job) {
      invoice.job_id = jobId;
      invoice.client_id = job.client_id;
      invoice.reference = job.address;
      const contact = (job.details as { contact?: { nameOrCompany?: string } } | null)?.contact;
      invoice.bill_to = contact?.nameOrCompany || null;
    }
  }

  let { data: row, error } = await supabase.from("invoices").insert(invoice).select("id").single();
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    // Migration 0035 not run yet — create the invoice without the copied
    // payment details rather than refusing to invoice at all.
    delete invoice.payment_details;
    ({ data: row, error } = await supabase.from("invoices").insert(invoice).select("id").single());
  }
  if (error || !row) return;
  if (feeLines.length > 0) {
    await supabase.from("invoice_lines").insert(feeLines.map((l) => ({ ...l, invoice_id: row.id })));
  }
  redirect(`/invoices/${row.id}`);
}

export async function updateInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id"));

  const { error } = await supabase
    .from("invoices")
    .update({
      invoice_number: String(formData.get("invoice_number") || "").trim() || null,
      issue_date: String(formData.get("issue_date") || todayISO()),
      due_date: String(formData.get("due_date") || "") || null,
      bill_to: String(formData.get("bill_to") || "").trim() || null,
      reference: String(formData.get("reference") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      payment_details: String(formData.get("payment_details") || "").trim() || null,
      client_id: String(formData.get("client_id") || "") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };
  revalidatePath(`/invoices/${invoiceId}`);
  return { savedAt: Date.now() };
}

export async function addInvoiceLine(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id"));
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (!description) return;
  const { data: existing } = await supabase.from("invoice_lines").select("sort_order").eq("invoice_id", invoiceId);
  const sortOrder = Math.max(-1, ...(existing || []).map((l) => l.sort_order)) + 1;
  await supabase.from("invoice_lines").insert({ invoice_id: invoiceId, description, quantity: "1", amount, sort_order: sortOrder });
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function removeInvoiceLine(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id"));
  await supabase.from("invoice_lines").delete().eq("id", String(formData.get("line_id")));
  revalidatePath(`/invoices/${invoiceId}`);
}

// draft -> sent -> paid, with void available before payment. Paid keeps
// the date it happened; anything else clears it, so un-marking a payment
// leaves no stale date behind.
export async function setInvoiceStatus(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id"));
  const status = String(formData.get("status"));
  if (!["draft", "sent", "paid", "void"].includes(status)) return;

  await supabase
    .from("invoices")
    .update({ status, paid_date: status === "paid" ? todayISO() : null, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("firm_id", profile.firm_id);

  if (status === "paid") {
    const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
    if (invoice) {
      await recordAuditEvent(supabase, {
        firmId: profile.firm_id,
        action: "invoice.paid",
        summary: `Invoice ${invoiceNumberOf(invoice as Invoice)} marked paid`,
        jobId: invoice.job_id,
        jobAddress: invoice.reference,
        actor: profile,
      });
    }
  }
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

// Only a draft can be deleted — it was never issued, so nothing refers
// to it. A sent invoice is voided instead, keeping its number on record.
export async function deleteInvoice(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id"));
  await supabase.from("invoices").delete().eq("id", invoiceId).eq("firm_id", profile.firm_id).eq("status", "draft");
  redirect("/invoices");
}

// A card-payment link for this invoice, created once on the certifier's
// click and reused from then on — in the email, and on the printed
// invoice. Created against this firm's own Stripe account, so the money
// arrives in this firm's bank account and no other.
export async function createCardPaymentLink(_prev: InvoiceEmailState, formData: FormData): Promise<InvoiceEmailState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id"));
  // Read with the service-role client: the credentials table has no read
  // policy, so a certifier's own session cannot select from it.
  const credentials = await firmStripeCredentials(createAdminClient(), profile.firm_id);
  if (!credentials.secretKey) return { error: "Card payments aren't connected yet — add your Stripe keys in Settings → Payment details." };

  const [{ data: invoice }, { data: lines }, { data: firmRow }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).eq("firm_id", profile.firm_id).single(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", invoiceId).order("sort_order"),
    supabase.from("firms").select("card_surcharge_enabled").eq("id", profile.firm_id).maybeSingle(),
  ]);
  if (!invoice) return { error: "Invoice not found." };
  const typed = invoice as Invoice;
  if (typed.stripe_payment_link_url) return { success: "This invoice already has its payment link." };
  const { total } = invoiceTotals((lines || []) as InvoiceLine[]);
  if (total <= 0) return { error: "Add the fees first — a payment link needs an amount." };

  // The optional surcharge: only while the firm has switched it on, and
  // never from 1 October 2026, when Australia's ban begins.
  const wantsSurcharge = (firmRow as { card_surcharge_enabled?: boolean } | null)?.card_surcharge_enabled === true;
  const surcharged = wantsSurcharge ? cardSurchargeFor(total, todayISO()) : null;
  const chargeTotal = surcharged ? surcharged.grossTotal : total;

  const link = await createInvoicePaymentLink({
    invoiceId,
    invoiceNumber: invoiceNumberOf(typed),
    reference: surcharged ? `${typed.reference || ""} (incl. ${formatMoney(surcharged.surcharge)} card surcharge)`.trim() : typed.reference,
    totalIncGst: chargeTotal,
    secretKey: credentials.secretKey,
  });
  if ("error" in link) return { error: link.error };

  const { error } = await supabase
    .from("invoices")
    .update({
      stripe_payment_link_id: link.linkId,
      stripe_payment_link_url: link.url,
      card_surcharge: surcharged ? surcharged.surcharge : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (error) return { error: error.code === "PGRST204" || error.code === "42703" ? "Run database update 0035 first (Settings → System check)." : error.message };
  revalidatePath(`/invoices/${invoiceId}`);
  return {
    success: surcharged
      ? `Card payment link created — card payments will total ${formatMoney(surcharged.grossTotal)} (${formatMoney(surcharged.surcharge)} surcharge).`
      : "Card payment link created — it will be included when the invoice is emailed.",
  };
}

// An invoice that shouldn't be chased — a disputed one, a client on an
// agreed payment plan. Per invoice and reversible.
export async function toggleInvoiceReminders(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id"));
  const paused = String(formData.get("paused")) === "true";
  await supabase.from("invoices").update({ reminders_paused: paused }).eq("id", invoiceId).eq("firm_id", profile.firm_id);
  revalidatePath(`/invoices/${invoiceId}`);
}

export type InvoiceEmailState = { error?: string; success?: string } | undefined;

// Emails the invoice to its client and marks it sent. The email carries
// the full breakdown; the printed document is the same numbers on the
// letterhead, exported from the invoice's document page.
export async function emailInvoiceToClient(_prev: InvoiceEmailState, formData: FormData): Promise<InvoiceEmailState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id"));

  const [{ data: invoice }, { data: lines }, { data: firm }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).eq("firm_id", profile.firm_id).single(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", invoiceId).order("sort_order"),
    supabase.from("firms").select("name, email").eq("id", profile.firm_id).single(),
  ]);
  if (!invoice) return { error: "Invoice not found." };
  if (!invoice.client_id) return { error: "Choose which client this invoice goes to first." };
  if (!(await firmEmailConfigured(supabase))) return { error: "Email isn't switched on yet — connect your Resend account in Settings → Email sending." };

  const { data: client } = await supabase.from("clients").select("name, email").eq("id", invoice.client_id).single();
  if (!client?.email) return { error: "That client has no email address on file — add one in their record." };

  // An invoice with no fee lines on it is an invoice nobody finished
  // writing, and it reaches the client reading "Total due $0.00".
  // Creating a card payment link has always refused this; sending the
  // invoice itself did not, which was the wrong way round — the link is
  // ours to retry, the email is the client's to receive.
  //
  // The test is "no lines", not "totals zero": an invoice deliberately
  // written to nil — a warranty visit, a job done as a favour — is a
  // decision, and still goes.
  if ((lines || []).length === 0) {
    return { error: "This invoice has no fees on it yet — add them first, or your client receives an invoice for $0.00." };
  }

  const typed = invoice as Invoice;
  const { total } = invoiceTotals((lines || []) as InvoiceLine[]);
  const number = invoiceNumberOf(typed);

  const html = invoiceEmailHtml({
    clientName: client.name ?? null,
    invoiceNumber: number,
    reference: typed.reference ?? null,
    lines: (lines || []) as InvoiceLine[],
    dueDate: typed.due_date ?? null,
    paymentLinkUrl: typed.stripe_payment_link_url || null,
    cardSurcharge: typed.card_surcharge ?? null,
    paymentDetails: typed.payment_details ?? null,
    notes: typed.notes ?? null,
    portalUrl: await siteUrl(),
    firmName: firm?.name ?? null,
  });

  // The invoice travels as a PDF as well as in the body, so the client
  // can file it or forward it to their accountant without logging in
  // anywhere. A failure to build it never costs them the email — it is
  // reported instead, and the wording below says which one went.
  const file = await buildInvoiceFile(invoiceId, supabase);
  const result = await sendEmail(
    client.email,
    `Invoice ${number}${typed.reference ? ` — ${typed.reference}` : ""}`,
    html,
    file ? [{ filename: file.fileName, content: Buffer.from(file.bytes) }] : undefined,
    // From this firm, not the deployment's. A second firm's client
    // should never see the first firm's name on their invoice.
    await firmSender(supabase, profile.firm_id)
  );
  if (!result.sent) return { error: result.error || "The email could not be sent." };

  await supabase.from("invoices").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", invoiceId).eq("status", "draft");
  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "invoice.sent",
    summary: `Invoice ${number} (${formatMoney(total)}) emailed to ${client.email}`,
    jobId: typed.job_id,
    jobAddress: typed.reference,
    actor: profile,
    detail: { total },
  });
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { success: file ? `Invoice emailed to ${client.email} with the PDF attached.` : `Invoice emailed to ${client.email}, but the PDF could not be built to attach.` };
}

