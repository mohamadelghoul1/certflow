"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { WORDING_KEYS, type WordingKey } from "@/lib/certificates/documentWording";
import type { ActionState } from "@/lib/actions/auth";

// A firm's own wording for one approval document.
//
// Saved empty means "go back to Certlyn's standard wording" rather than
// "print nothing" — the same rule the certificate's own rows follow, and
// the one a person expects when they clear a box they have second
// thoughts about.
export async function saveDocumentWording(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile, userId } = await requireProfile("certifier");
  const supabase = await createClient();

  const key = String(formData.get("doc_key") || "") as WordingKey;
  if (!WORDING_KEYS.includes(key)) return { error: "That isn't a document Certlyn knows about." };
  const body = String(formData.get("body") || "").trim();

  if (!body) {
    const { error } = await supabase.from("firm_document_wording").delete().eq("firm_id", profile.firm_id).eq("doc_key", key);
    if (error) return { error: wordingError(error.code, error.message) };
    revalidatePath("/settings");
    return { savedAt: Date.now() };
  }

  const { error } = await supabase
    .from("firm_document_wording")
    .upsert({ firm_id: profile.firm_id, doc_key: key, body, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "firm_id,doc_key" });
  if (error) return { error: wordingError(error.code, error.message) };
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}

function wordingError(code: string | undefined, message: string): string {
  const missing = ["42P01", "PGRST205", "PGRST106"];
  return missing.includes(code || "") ? "Run database update 0064 first (Settings → System check)." : message;
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
