"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addLibraryItem(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const pathway = String(formData.get("pathway"));
  const title = String(formData.get("title") || "").trim();
  if (!title) return;

  const { count } = await supabase
    .from("document_library_items")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", profile.firm_id)
    .eq("pathway", pathway);

  await supabase.from("document_library_items").insert({
    firm_id: profile.firm_id,
    pathway,
    title,
    description: String(formData.get("description") || ""),
    category: String(formData.get("category") || "Other"),
    sort_order: count || 0,
  });
  revalidatePath("/settings");
}

export async function removeLibraryItem(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("document_library_items").delete().eq("id", id).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}
