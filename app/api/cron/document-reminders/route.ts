import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDocumentReminders } from "@/lib/documentReminders";

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

  const summary = await runDocumentReminders(createAdminClient());
  return NextResponse.json(summary);
}
