import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildInvoiceFile } from "@/lib/invoices/invoiceDocument";

// The certifier's own copy of the tax invoice — the same file the
// client is emailed and can download from the portal, so there is never
// a question of which version someone is looking at.
//
// Read through the certifier's own session, so RLS decides whether this
// invoice belongs to their firm.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: invoice } = await supabase.from("invoices").select("id").eq("id", id).eq("firm_id", profile.firm_id).maybeSingle();
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });

  const file = await buildInvoiceFile(id, supabase);
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file.fileName}"` },
  });
}
