import type { SupabaseClient } from "@supabase/supabase-js";

// Writing the row that has no firm against it — Certlyn's own default,
// which every firm that has saved nothing of its own is drawn from.
//
// Not an upsert: PostgREST resolves a conflict against a named unique
// constraint, and the platform rows are kept unique by a partial index
// over "firm_id is null" instead (migration 0069) — two NULLs are never
// equal, so the table's own unique(firm_id, …) does not constrain them.
// So the row is looked for, then updated or inserted.
export async function savePlatformRow(
  supabase: SupabaseClient,
  table: "certificate_templates" | "firm_document_wording",
  match: Record<string, string>,
  values: Record<string, unknown>,
): Promise<{ error: { code?: string; message: string } | null }> {
  const find = Object.entries(match).reduce((query, [column, value]) => query.eq(column, value), supabase.from(table).select("id").is("firm_id", null));
  const { data: existing } = await find.maybeSingle();

  const row = { ...values, firm_id: null, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await supabase.from(table).update(row).eq("id", (existing as { id: string }).id)
    : await supabase.from(table).insert(row);
  return { error };
}
