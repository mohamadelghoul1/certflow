import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// "Anything new since I last looked?" — polled by the certifier app
// while it's open, so a client upload can chime on screen without
// waiting for the email. Reads through the admin client because
// portal_uploads deliberately has no row policies; the firm scope is
// applied here from the signed-in certifier's own profile.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role, firm_id").eq("id", user.id).single();
  if (!profile || profile.role !== "certifier") return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const since = request.nextUrl.searchParams.get("since");
  const now = new Date().toISOString();
  if (!since) return NextResponse.json({ uploads: [], now });

  const admin = createAdminClient();
  const { data } = await admin
    .from("portal_uploads")
    .select("file_name, item_title, uploaded_at, jobs!inner(address, firm_id)")
    .eq("jobs.firm_id", profile.firm_id)
    .gt("uploaded_at", since)
    .order("uploaded_at")
    .limit(20);

  const uploads = (data || []).map((row) => ({
    fileName: row.file_name as string | null,
    itemTitle: row.item_title as string | null,
    address: ((row.jobs as unknown as { address: string | null } | null)?.address ?? null) as string | null,
    uploadedAt: row.uploaded_at as string,
  }));
  return NextResponse.json({ uploads, now });
}
