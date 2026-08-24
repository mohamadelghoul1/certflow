import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Hands over the firm's blank form for one checklist item — the contract,
// an application form, the notice of commencement.
//
// The file itself lives on the firm's document library row, outside the
// {firm}/{job}/ prefix a client's storage access is scoped to, so a client
// can't sign a URL for it themselves. This route does it for them: the
// checklist item is read as the signed-in user first, which is what
// decides whether they're allowed to see it at all (a client only sees
// items on their own projects; a certifier only their own firm's), and
// only then does the admin client resolve the file behind it. Same
// arrangement as the portal's certificate downloads.
export async function GET(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: item } = await supabase.from("checklist_items").select("template_library_item_id").eq("id", itemId).single();
  if (!item?.template_library_item_id) return NextResponse.json({ error: "no form for this item" }, { status: 404 });

  const admin = createAdminClient();
  const { data: libraryItem } = await admin
    .from("document_library_items")
    .select("template_file_path, template_file_name")
    .eq("id", item.template_library_item_id)
    .single();
  if (!libraryItem?.template_file_path) return NextResponse.json({ error: "no form for this item" }, { status: 404 });

  // `download` makes the browser save it under the name the certifier
  // uploaded rather than the timestamped storage key.
  const { data: signed } = await admin.storage
    .from("certflow-files")
    .createSignedUrl(libraryItem.template_file_path, 3600, { download: libraryItem.template_file_name || true });
  if (!signed?.signedUrl) return NextResponse.json({ error: "could not open that form" }, { status: 404 });

  return NextResponse.redirect(signed.signedUrl);
}
