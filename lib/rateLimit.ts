import type { SupabaseClient } from "@supabase/supabase-js";

// A limit on how often the same person can do the expensive or the
// guessable things.
//
// Counting in the application's own memory does not work here: the app
// runs as separate short-lived functions, so each one starts with an
// empty count and none of them can see the others. The count lives in
// the database, where every one of them looks at the same number, and
// the counting and the decision happen in a single statement because
// two requests racing each other is precisely the case a rate limit
// exists for.

export type Limit = { windowSeconds: number; max: number };

// A login attempt is cheap for us and cheap for someone guessing
// passwords, which is why it needs a ceiling at all. Ten a minute is
// well past anyone typing their own password in badly.
export const LOGIN_LIMIT: Limit = { windowSeconds: 60, max: 10 };

// The approved set and the job archive assemble every document in a job
// into one file. A handful an hour is normal use; a hundred is not.
export const HEAVY_DOWNLOAD_LIMIT: Limit = { windowSeconds: 3600, max: 60 };

// True when the caller is still inside its allowance. A database that
// has not had migration 0028 run against it has no such function, and
// the answer then is yes — a missing rate limit must never be the thing
// that stops someone logging in.
export async function withinLimit(supabase: SupabaseClient, bucket: string, limit: Limit): Promise<boolean> {
  const { data, error } = await supabase.rpc("record_rate_limit_hit", {
    p_bucket: bucket,
    p_window_seconds: limit.windowSeconds,
    p_limit: limit.max,
  });
  if (error) return true;
  return data !== false;
}

// What the counting is keyed on. An email address for a login, so one
// account being guessed at does not lock out everyone else; the user's
// own id for a download, because that is who the cost belongs to.
export function loginBucket(email: string): string {
  return `login:${email.trim().toLowerCase()}`;
}

export function downloadBucket(userId: string): string {
  return `download:${userId}`;
}
