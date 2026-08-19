import { createClient } from "@/lib/supabase/server";

export async function signedUrl(path: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("certflow-files").createSignedUrl(path, expiresIn);
  return data?.signedUrl || null;
}
