import type { SupabaseClient } from "@supabase/supabase-js";

// A firm's saved wording, or nothing at all.
//
// Nothing at all is the ordinary case and must stay cheap and quiet: a
// firm that has never opened the editor, and a database that has not run
// migration 0064, both come back the same way — empty — and every
// document then prints the default it always did.
export async function loadFirmWording(supabase: SupabaseClient, firmId: string): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase.from("firm_document_wording").select("doc_key, body").eq("firm_id", firmId);
    if (error || !data) return {};
    return Object.fromEntries((data as { doc_key: string; body: string }[]).map((r) => [r.doc_key, r.body]));
  } catch {
    return {};
  }
}
