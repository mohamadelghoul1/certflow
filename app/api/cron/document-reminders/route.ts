import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDocumentReminders } from "@/lib/documentReminders";
import { runInvoiceReminders } from "@/lib/invoiceReminders";
import { runUploadDigests } from "@/lib/uploadDigest";
import { runReviewDigests } from "@/lib/reviewDigest";
import { runDatabaseBackups } from "@/lib/backup/database";
import { runDeletedJobPurge } from "@/lib/deletedJobsPurge";

// The morning sweep, called by Vercel's scheduler (vercel.json) rather
// than by anyone's click. Vercel proves it is the scheduler by sending
// the CRON_SECRET the project holds; without that proof, anyone who
// found this URL could make the app email every client on demand.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  // One morning visit runs both sweeps — documents owed, and invoices
  // overdue — so the schedule stays a single entry.
  const admin = createAdminClient();
  const documents = await runDocumentReminders(admin);
  const invoices = await runInvoiceReminders(admin);
  // And a copy of the record itself to each firm's own cloud storage.
  // The documents have been copied as they were issued; this is the
  // register that says what they were — and it is the half nobody
  // notices is missing until they need it.
  const records = await runDatabaseBackups(admin);
  // Also mops up the batched notifications still waiting on a summary
  // email — the tail of a burst nothing else came along to flush:
  // client uploads (to the certifier) and review outcomes (to the client).
  const uploads = await runUploadDigests(admin);
  const reviews = await runReviewDigests(admin);
  // And the projects deleted more than thirty days ago go for good,
  // documents included — see lib/deletedJobsPurge.
  const purged = await runDeletedJobPurge(admin);
  return NextResponse.json({ documents, invoices, records, uploads, reviews, purged });
}
