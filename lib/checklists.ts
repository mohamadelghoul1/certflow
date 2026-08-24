import type { SupabaseClient } from "@supabase/supabase-js";

export type NewChecklistItem = {
  checklist_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  sort_order?: number;
  template_library_item_id?: string | null;
};

// True when the database rejected the write because it has never heard of
// one of the columns being sent. PostgREST reports it as PGRST204 off its
// schema cache; Postgres itself uses 42703 for an undefined column.
function isUnknownColumnError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703") return true;
  return /column/i.test(error.message || "") && /(does not exist|schema cache)/i.test(error.message || "");
}

// Filling a project's checklist is the one write that must not fail
// quietly — an empty checklist looks like the app forgot the project.
//
// Vercel deploys the moment code is pushed, while a migration is run by
// hand afterwards, so there is always a window where the code knows about
// a column the database doesn't. PostgREST rejects the *whole* insert when
// it's sent an unknown column, so during that window new projects came up
// with no documents at all and "+ Request documents" appeared to do
// nothing. This retries with only the columns that have always existed, so
// the checklist still gets filled; the blank-form links then appear once
// the migration has been run (it back-fills them for existing projects).
export async function insertChecklistItems(supabase: SupabaseClient, items: NewChecklistItem[]) {
  if (items.length === 0) return;

  const { error } = await supabase.from("checklist_items").insert(items);
  if (!error) return;

  if (isUnknownColumnError(error)) {
    const withoutTemplate = items.map(({ template_library_item_id: _ignored, ...rest }) => rest);
    const { error: retryError } = await supabase.from("checklist_items").insert(withoutTemplate);
    if (retryError) console.error("checklist items could not be created:", retryError.message);
    return;
  }

  console.error("checklist items could not be created:", error.message);
}
