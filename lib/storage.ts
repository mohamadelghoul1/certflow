import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Short-lived signed links for files in Storage.
//
// Every one of these is an HTTP round trip to Supabase, and a job page
// asks for a great many: two per checklist item (the document and its
// blank form), one per inspection report, one per photo, one per
// certificate version. A job with a couple of dozen documents was opening
// with ninety-odd separate requests, which is what made it slow.
//
// Storage can sign a whole list in one request, so calls made while the
// page is rendering are collected and sent together. Nothing at the call
// sites changes — they still await one path and get one URL.

type Pending = { path: string; expiresIn: number; resolve: (value: string | null) => void };
type Batcher = { queue: Pending[]; scheduled: boolean };

// One batcher per request, not per process. A module-level queue would
// let one user's paths be signed with another user's client, and storage
// permissions are enforced per user — React's cache() scopes this to the
// request that is rendering.
const getBatcher = cache((): Batcher => ({ queue: [], scheduled: false }));

// Paths grouped by how long they should live, and de-duplicated: the same
// file is often shown in two places on a page, and signing it twice is
// two round trips for one answer.
export function groupForSigning(items: Pending[]) {
  const groups = new Map<number, { paths: string[]; waiting: Pending[] }>();
  for (const item of items) {
    const group = groups.get(item.expiresIn) || { paths: [], waiting: [] };
    if (!group.paths.includes(item.path)) group.paths.push(item.path);
    group.waiting.push(item);
    groups.set(item.expiresIn, group);
  }
  return [...groups.entries()].map(([expiresIn, group]) => ({ expiresIn, ...group }));
}

async function flush(batcher: Batcher) {
  const batch = batcher.queue;
  batcher.queue = [];
  batcher.scheduled = false;
  if (batch.length === 0) return;

  const supabase = await createClient();

  await Promise.all(
    groupForSigning(batch).map(async ({ expiresIn, paths, waiting }) => {
      try {
        const { data, error } = await supabase.storage.from("certflow-files").createSignedUrls(paths, expiresIn);
        if (error || !data) throw error || new Error("no signed urls returned");
        const byPath = new Map(data.map((d) => [d.path, d.signedUrl]));
        waiting.forEach((item) => item.resolve(byPath.get(item.path) || null));
      } catch {
        // One unreadable path fails the whole list, so fall back to
        // signing them separately rather than losing every link on the
        // page because of a single missing file.
        await Promise.all(
          waiting.map(async (item) => {
            const { data } = await supabase.storage.from("certflow-files").createSignedUrl(item.path, item.expiresIn);
            item.resolve(data?.signedUrl || null);
          })
        );
      }
    })
  );
}

// `client` overrides the default request-scoped (RLS-enforcing) client.
// Only used by the portal's certificate-download routes, which assemble a
// document with the admin client *after* the client user's own permissions
// have already authorised the request — the firm logo and certifier
// signature live outside the {firm}/{job}/ prefix that client storage
// access is scoped to, so they can't be read as the client themselves.
// Those go straight out rather than into the batch, which belongs to the
// request's own client.
export async function signedUrl(path: string | null | undefined, expiresIn = 3600, client?: SupabaseClient): Promise<string | null> {
  if (!path) return null;

  if (client) {
    const { data } = await client.storage.from("certflow-files").createSignedUrl(path, expiresIn);
    return data?.signedUrl || null;
  }

  const batcher = getBatcher();
  return new Promise<string | null>((resolve) => {
    batcher.queue.push({ path, expiresIn, resolve });
    if (batcher.scheduled) return;
    batcher.scheduled = true;
    // Sent once the current run of rendering has finished queueing, so
    // everything the page asked for in this pass goes in one request.
    setTimeout(() => void flush(batcher), 0);
  });
}
