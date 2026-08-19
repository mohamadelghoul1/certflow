import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Server-only: never import
// this from a Client Component, and never expose SUPABASE_SERVICE_ROLE_KEY
// with the NEXT_PUBLIC_ prefix. Used only for the one thing regular
// user sessions can't do: creating a new auth user to invite a client.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
