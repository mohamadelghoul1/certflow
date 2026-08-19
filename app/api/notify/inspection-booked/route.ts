import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyJobCertifier } from "@/lib/email";
import { formatISODate } from "@/lib/business";

// Called by the client portal right after a successful inspection booking
// (build brief §10/§15) — a client-initiated event, so it can't hang off a
// certifier's own click the way every other notification does. Uses the
// admin client since there's no certifier session here to read another
// certifier's contact details through RLS.
export async function POST(request: NextRequest) {
  const { inspectionId, jobId, date } = await request.json();
  if (!inspectionId || !jobId) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const admin = createAdminClient();
  const { data: insp } = await admin.from("inspections").select("title").eq("id", inspectionId).single();

  await notifyJobCertifier(
    admin,
    jobId,
    "Client booked an inspection",
    `<p>Your client has booked the <strong>${insp?.title || "an"}</strong> inspection for <strong>${formatISODate(date)}</strong>. Please confirm it in CertFlow.</p>`
  );

  return NextResponse.json({ ok: true });
}
