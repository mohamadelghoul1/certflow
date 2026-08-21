import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// `client` overrides the default request-scoped (RLS-enforcing) client.
// Only used by the portal's certificate-download routes, which assemble a
// document with the admin client *after* the client user's own permissions
// have already authorised the request — the firm logo and certifier
// signature live outside the {firm}/{job}/ prefix that client storage
// access is scoped to, so they can't be read as the client themselves.
export async function signedUrl(path: string | null | undefined, expiresIn = 3600, client?: SupabaseClient): Promise<string | null> {
  if (!path) return null;
  const supabase = client ?? (await createClient());
  const { data } = await supabase.storage.from("certflow-files").createSignedUrl(path, expiresIn);
  return data?.signedUrl || null;
}
