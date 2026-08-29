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

// A stored file's bytes, for a document being assembled server-side —
// the approved set, the Occupation Certificate set, a signed report
// going into a bundle. Returns null rather than throwing: a document
// that cannot be read is named on the set's closing page, which is more
// use than a failed download.
export async function fetchStoredFile(
  path: string | null | undefined,
  client?: SupabaseClient
): Promise<{ bytes: Uint8Array; contentType: string | null } | null> {
  const url = await signedUrl(path, 3600, client);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") };
  } catch {
    return null;
  }
}

// Everything under a folder, however deep.
//
// Supabase's list() is not recursive: asked for a project's folder it
// answers with the folders inside it — checklist, inspections,
// certificates — not the files under those. Handing those folder paths
// to remove() deletes nothing at all and reports no error, which is how
// purging a project could leave every one of its documents behind,
// invisible to the app and still counting against the storage quota.
//
// A folder is told from a file by its id: Supabase gives real objects an
// id and folders none.
export async function listFilesRecursively(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
  // Guards against a cycle or a pathological tree costing a request per
  // level forever. Nothing in CertFlow nests more than four deep.
  depth = 0,
): Promise<string[]> {
  if (depth > 8) return [];

  const found: string[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: pageSize, offset });
    if (error || !data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) found.push(path);
      else found.push(...(await listFilesRecursively(client, bucket, path, depth + 1)));
    }

    if (data.length < pageSize) break;
  }

  return found;
}

// Delete a folder and everything under it. Returns how many files went,
// so a caller can say so rather than claiming a cleanup it did not do.
export async function removeFolder(client: SupabaseClient, bucket: string, prefix: string): Promise<{ removed: number; error?: string }> {
  const paths = await listFilesRecursively(client, bucket, prefix);
  if (paths.length === 0) return { removed: 0 };

  let removed = 0;
  // In batches: a project with hundreds of photos is one request per
  // batch rather than one enormous one that times out.
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await client.storage.from(bucket).remove(batch);
    if (error) return { removed, error: error.message };
    removed += batch.length;
  }
  return { removed };
}
