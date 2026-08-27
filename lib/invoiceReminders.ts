import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { recordAuditEvent } from "@/lib/audit";
import { invoiceTotals, invoiceNumberOf, formatMoney } from "@/lib/invoices/invoiceLogic";
import { formatISODate } from "@/lib/business";
import type { Invoice, InvoiceLine } from "@/types/db";

// The polite version of "your invoice is overdue", written by the sweep
// instead of the certifier.
//
// One reality shapes everything here: a bank transfer is invisible to
// the software. Card payments mark themselves paid; a transfer sits as
// "sent" until the certifier presses Mark as paid — so a chased client
// may have already paid, and every email says so plainly and asks to be
// disregarded. Chasing starts only once genuinely overdue, repeats at
// the firm's chosen interval, and stops dead the moment the invoice is
// marked paid or voided.

const day = 24 * 60 * 60 * 1000;

// Due when at least a full day overdue, and the interval has passed
// since the last chase (the first chase needs no interval — being
// overdue is reason enough).
export function paymentReminderDue(
  opts: { dueDate: string | null; lastReminderAt?: string | null; everyDays: number },
  now: Date
): boolean {
  if (!opts.dueDate) return false;
  const overdueMs = now.getTime() - new Date(`${opts.dueDate}T00:00:00Z`).getTime();
  if (overdueMs < day) return false;
  if (!opts.lastReminderAt) return true;
  return now.getTime() - new Date(opts.lastReminderAt).getTime() >= opts.everyDays * day;
}

export function paymentReminderHtml(opts: {
  clientName: string;
  invoiceNumber: string;
  reference: string | null;
  total: number;
  dueDate: string;
  paymentDetails: string | null;
  paymentLinkUrl: string | null;
}): { subject: string; html: string } {
  const escape = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts = [
    `<p>Hi ${escape(opts.clientName || "there")},</p>`,
    `<p>Just a friendly reminder that invoice <strong>${escape(opts.invoiceNumber)}</strong>${
      opts.reference ? ` for <strong>${escape(opts.reference)}</strong>` : ""
    } — <strong>${formatMoney(opts.total)}</strong> — was due on ${formatISODate(opts.dueDate)}.</p>`,
    opts.paymentLinkUrl
      ? `<p><a href="${opts.paymentLinkUrl}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:bold">Pay online by card</a></p>`
      : "",
    opts.paymentDetails ? `<p style="padding:10px 12px;background:#f8fafc;border-radius:6px;white-space:pre-line">${escape(opts.paymentDetails)}</p>` : "",
    `<p>If you&rsquo;ve already paid, please disregard this — bank transfers can take a day or two to be matched up on our side.</p>`,
  ];
  return { subject: `Payment reminder — Invoice ${opts.invoiceNumber}`, html: parts.join("") };
}

export type InvoiceReminderSummary = { ready: boolean; considered: number; sent: number; notes: string[] };

function isMissingColumn(error: { code?: string | null } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST100" || error?.code === "42P01" || error?.code === "PGRST205";
}

export async function runInvoiceReminders(admin: SupabaseClient, now: Date = new Date()): Promise<InvoiceReminderSummary> {
  const summary: InvoiceReminderSummary = { ready: true, considered: 0, sent: 0, notes: [] };
  const todayIso = now.toISOString().slice(0, 10);

  const { data: firms, error: firmsError } = await admin.from("firms").select("id, invoice_reminders_enabled, invoice_reminder_days");
  if (firmsError) {
    summary.ready = !isMissingColumn(firmsError);
    summary.notes.push(summary.ready ? `firms: ${firmsError.message}` : "migration 0038 has not been run yet");
    return summary;
  }
  const settings = new Map(
    (firms || []).map((f) => [f.id as string, { enabled: f.invoice_reminders_enabled !== false, everyDays: Number(f.invoice_reminder_days) || 7 }])
  );

  const { data: invoices, error: invoicesError } = await admin
    .from("invoices")
    .select("*, clients(name, email), invoice_lines(amount)")
    .eq("status", "sent")
    .eq("reminders_paused", false)
    .not("client_id", "is", null)
    .not("due_date", "is", null)
    .lt("due_date", todayIso);
  if (invoicesError) {
    summary.ready = !isMissingColumn(invoicesError);
    summary.notes.push(summary.ready ? `invoices: ${invoicesError.message}` : "migration 0038 has not been run yet");
    return summary;
  }

  for (const invoice of invoices || []) {
    const firm = settings.get(invoice.firm_id as string);
    if (!firm?.enabled) continue;
    summary.considered++;
    const typed = invoice as Invoice & { clients: { name: string | null; email: string | null } | null; invoice_lines: Pick<InvoiceLine, "amount">[] };
    if (!paymentReminderDue({ dueDate: typed.due_date, lastReminderAt: typed.last_payment_reminder_at, everyDays: firm.everyDays }, now)) continue;
    if (!typed.clients?.email) continue;

    const { total } = invoiceTotals(typed.invoice_lines || []);
    const number = invoiceNumberOf(typed);
    const { subject, html } = paymentReminderHtml({
      clientName: typed.clients.name || "",
      invoiceNumber: number,
      reference: typed.reference,
      total,
      dueDate: typed.due_date!,
      paymentDetails: typed.payment_details || null,
      paymentLinkUrl: typed.stripe_payment_link_url || null,
    });
    const result = await sendEmail(typed.clients.email, subject, html);
    // The clock moves either way: a bad address becomes a weekly note in
    // the audit log, not a daily one.
    await admin.from("invoices").update({ last_payment_reminder_at: now.toISOString() }).eq("id", typed.id);
    await recordAuditEvent(admin, {
      firmId: typed.firm_id,
      action: result.sent ? "invoice.reminder" : "email.failed",
      summary: result.sent
        ? `Payment reminder for invoice ${number} (${formatMoney(total)}) emailed to ${typed.clients.email}`
        : `Could not email payment reminder for invoice ${number}: ${result.error || "email not configured"}`,
      jobId: typed.job_id,
      jobAddress: typed.reference,
      detail: { total },
      severity: result.sent ? "info" : "error",
    });
    if (result.sent) summary.sent++;
  }

  return summary;
}
