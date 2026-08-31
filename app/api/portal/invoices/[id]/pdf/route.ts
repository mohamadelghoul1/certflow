import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { withinLimit, downloadBucket, HEAVY_DOWNLOAD_LIMIT } from "@/lib/rateLimit";
import { buildInvoiceFile } from "@/lib/invoices/invoiceDocument";

// The client's own copy of an invoice.
//
// Invoices are a firm's records, so client RLS grants nothing on them
// at all — which is why this reads with the admin client and decides
// entitlement itself, in two parts:
//   1. requireProfile("client") — a signed-in client.
//   2. The invoice must be addressed to that client's own record, and
//      must have been issued. A draft is the certifier still working on
//      it and is nobody else's business until it is sent.
//
// Someone with shared access to a project therefore cannot pull the
// invoice for it: being able to see a job is not being the person billed
// for it.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, userId } = await requireProfile("client");

  // The same ceiling the certifier's own downloads sit behind: the
  // invoice PDF is built from scratch on every request.
  const supabase = await createClient();
  if (!(await withinLimit(supabase, downloadBucket(userId), HEAVY_DOWNLOAD_LIMIT))) {
    return NextResponse.json({ error: "That is a lot of downloads in a short time. Give it a few minutes and try again." }, { status: 429 });
  }
  if (!profile.client_id) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: invoice } = await admin.from("invoices").select("id, client_id, status").eq("id", id).maybeSingle();
  if (!invoice || invoice.client_id !== profile.client_id || invoice.status === "draft") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const file = await buildInvoiceFile(id, admin);
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file.fileName}"` },
  });
}
