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

// Writes the order the certifier dragged the documents into. The ids
// come from the browser, so each write stays scoped to the firm — an id
// that isn't theirs simply updates nothing.
export async function reorderLibraryItems(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  let ids: string[] = [];
  try {
    ids = JSON.parse(String(formData.get("ids") || "[]"));
  } catch {
    return;
  }
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) return;

  await Promise.all(
    ids.map((id, position) =>
      supabase.from("document_library_items").update({ sort_order: position }).eq("id", String(id)).eq("firm_id", profile.firm_id)
    )
  );
  revalidatePath("/settings");
}

export async function removeLibraryItem(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("document_library_items").delete().eq("id", id).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

// Attaches the firm's own blank form to a library item — the contract, an
// application form, the notice of commencement — for the client to
// download, complete and upload back. Stored on the library row rather
// than copied onto each project, so replacing it here replaces it
// everywhere the moment it's uploaded.
export async function setLibraryTemplate(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const filePath = String(formData.get("file_path") || "");
  if (!filePath) return;

  // The name shown to the client, taken from the file they uploaded. The
  // stored path carries a timestamp prefix to keep replacements from
  // overwriting each other, which is not something anyone wants to read.
  const fileName = filePath.split("/").pop()?.replace(/^\d+-/, "") || "form";

  await supabase
    .from("document_library_items")
    .update({ template_file_path: filePath, template_file_name: fileName })
    .eq("id", id)
    .eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function clearLibraryTemplate(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const id = String(formData.get("id"));
  // The stored file itself is left in place: a form that was handed to
  // clients is worth keeping, and removing the link is what stops it being
  // offered from here on.
  await supabase
    .from("document_library_items")
    .update({ template_file_path: null, template_file_name: null })
    .eq("id", id)
    .eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}
