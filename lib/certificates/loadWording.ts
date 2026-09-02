import type { SupabaseClient } from "@supabase/supabase-js";

// A firm's saved wording, or nothing at all.
//
// Nothing at all is the ordinary case and must stay cheap and quiet: a
// firm that has never opened the editor, and a database that has not run
// migration 0064, both come back the same way — empty — and every
// document then prints the default it always did.
export async function loadFirmWording(supabase: SupabaseClient, firmId: string): Promise<Record<string, string>> {
  try {
    // The firm's own wording, over the platform default the owner
    // published, over nothing — in which case every document prints the
    // built-in wording it always did.
    const { data, error } = await supabase
      .from("firm_document_wording")
      .select("firm_id, doc_key, body")
      .or(`firm_id.eq.${firmId},firm_id.is.null`);
    if (error || !data) return {};
    const rows = data as { firm_id: string | null; doc_key: string; body: string }[];
    const wording: Record<string, string> = {};
    for (const row of rows.filter((r) => r.firm_id === null)) wording[row.doc_key] = row.body;
    for (const row of rows.filter((r) => r.firm_id === firmId)) wording[row.doc_key] = row.body;
    return wording;
  } catch {
    return {};
  }
}
