import type { SupabaseClient } from "@supabase/supabase-js";

// Which firm runs Certlyn, as opposed to the firms using it.
//
// The owner sees what belongs to the deployment rather than to a firm —
// the storage the plan allows — and can publish the standard certificate
// layout and letter wording that every firm starts from. A firm using
// Certlyn sees neither.
//
// A database without migration 0068 has no such flag, and then there is
// only one firm: it is the owner. That keeps a deployment that is
// running behind working exactly as it did.
export async function isPlatformOwner(supabase: SupabaseClient, firmId: string): Promise<boolean> {
  try {
    // select("*") on purpose: naming a column that migration 0068 has
    // not added yet fails the whole lookup, and losing a settings
    // section to a missing column is worse than reading a wider row.
    const { data } = await supabase.from("firms").select("*").eq("id", firmId).maybeSingle();
    return (data as { platform_owner?: boolean } | null)?.platform_owner ?? true;
  } catch {
    return true;
  }
}
