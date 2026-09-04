"use server";

import { createClient } from "@/lib/supabase/server";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { WORDING_KEYS, type WordingKey } from "@/lib/certificates/documentWording";
import { isPlatformOwner } from "@/lib/platformOwner";
import { savePlatformRow } from "@/lib/actions/platformDefaults";
import type { ActionState } from "@/lib/actions/auth";

// A firm's own wording for one approval document.
//
// Saved empty means "go back to Certlyn's standard wording" rather than
// "print nothing" — the same rule the certificate's own rows follow, and
// the one a person expects when they clear a box they have second
// thoughts about.
export async function saveDocumentWording(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile, userId } = await requireDirector();
  const supabase = await createClient();

  const key = String(formData.get("doc_key") || "") as WordingKey;
  if (!WORDING_KEYS.includes(key)) return { error: "That isn't a document Certlyn knows about." };
  const body = String(formData.get("body") || "").trim();

  // Saved for this firm, or — for the firm that runs Certlyn — as the
  // wording every firm starts from. Checked here as well as in the
  // database: a form field is a suggestion, not a permission.
  const forEveryFirm = String(formData.get("scope") || "") === "platform";
  if (forEveryFirm && !(await isPlatformOwner(supabase, profile.firm_id))) {
    return { error: "Only the firm that runs Certlyn can change the standard wording." };
  }

  if (!body) {
    const query = supabase.from("firm_document_wording").delete().eq("doc_key", key);
    const { error } = await (forEveryFirm ? query.is("firm_id", null) : query.eq("firm_id", profile.firm_id));
    if (error) return { error: wordingError(error.code, error.message) };
    revalidatePath("/settings");
    return { savedAt: Date.now() };
  }

  const saved = forEveryFirm
    ? await savePlatformRow(supabase, "firm_document_wording", { doc_key: key }, { doc_key: key, body, updated_by: userId })
    : await supabase
        .from("firm_document_wording")
        .upsert({ firm_id: profile.firm_id, doc_key: key, body, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "firm_id,doc_key" });
  if (saved.error) return { error: wordingError(saved.error.code, saved.error.message) };
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}

function wordingError(code: string | undefined, message: string): string {
  const missing = ["42P01", "PGRST205", "PGRST106"];
  return missing.includes(code || "") ? "Run database update 0064 first (Settings → System check)." : message;
}

// What the owner published as the standard, for the editor to show
// alongside the firm's own. Empty for everyone else — and empty is the
// right answer for them, since the box then opens on the built-in text.
export async function platformWordingForSettings(): Promise<Record<string, string>> {
  const supabase = await createClient();
  try {
    const { data } = await supabase.from("firm_document_wording").select("doc_key, body").is("firm_id", null);
    return Object.fromEntries(((data || []) as { doc_key: string; body: string }[]).map((r) => [r.doc_key, r.body]));
  } catch {
    return {};
  }
}

export async function firmWordingForSettings(firmId: string): Promise<Record<string, string>> {
  const supabase = await createClient();
  try {
    const { data } = await supabase.from("firm_document_wording").select("doc_key, body").eq("firm_id", firmId);
    return Object.fromEntries(((data || []) as { doc_key: string; body: string }[]).map((r) => [r.doc_key, r.body]));
  } catch {
    return {};
  }
}
