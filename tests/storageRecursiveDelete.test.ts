import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listFilesRecursively, removeFolder } from "@/lib/storage";

// Purging a project is supposed to take its documents with it. Supabase's
// list() is not recursive, so the old code handed it folder paths and
// deleted nothing — silently, with no error — leaving every document
// behind and still counting against the quota.

// A stand-in for Supabase Storage holding a real project's shape.
function fakeStorage(files: string[]) {
  const removed: string[] = [];
  const live = new Set(files);

  return {
    removed,
    client: {
      storage: {
        from() {
          return {
            list(prefix: string, opts: { limit: number; offset: number }) {
              const children = new Map<string, boolean>();
              for (const path of live) {
                if (!path.startsWith(prefix ? `${prefix}/` : "")) continue;
                const rest = path.slice(prefix ? prefix.length + 1 : 0);
                const head = rest.split("/")[0];
                // A file has an id; a folder does not — exactly how
                // Supabase tells them apart.
                children.set(head, rest.includes("/") ? false : true);
              }
              const rows = [...children.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, isFile]) => ({ name, id: isFile ? `id-${name}` : null }));
              return Promise.resolve({ data: rows.slice(opts.offset, opts.offset + opts.limit), error: null });
            },
            remove(paths: string[]) {
              for (const p of paths) {
                // Removing a folder path is a no-op, as it is in reality.
                if (live.delete(p)) removed.push(p);
              }
              return Promise.resolve({ error: null });
            },
          };
        },
      },
    } as unknown as SupabaseClient,
  };
}

const PROJECT = [
  "firm-1/job-1/certificates/approved-set.pdf",
  "firm-1/job-1/checklist/item-a/plans.pdf",
  "firm-1/job-1/checklist/item-a/plans-v2.pdf",
  "firm-1/job-1/checklist/item-b/basix.pdf",
  "firm-1/job-1/inspections/insp-1/report.pdf",
  "firm-1/job-1/inspections/insp-1/photos/01.jpg",
  "firm-1/job-1/inspections/insp-2/report.pdf",
  // Another project, which must survive.
  "firm-1/job-2/checklist/item-c/other.pdf",
];

describe("finding every file under a project", () => {
  test("reaches files nested several folders deep", async () => {
    const { client } = fakeStorage(PROJECT);
    const found = await listFilesRecursively(client, "certflow-files", "firm-1/job-1");
    assert.deepEqual(found.sort(), PROJECT.filter((p) => p.startsWith("firm-1/job-1/")).sort());
    assert.equal(found.length, 7);
  });

  // The bug in one assertion: one level down there are no files at all,
  // only folders, so the old code had nothing to delete.
  test("one level down there are no files — which is why nothing was deleted", async () => {
    const { client } = fakeStorage(PROJECT);
    const { data } = await client.storage.from("certflow-files").list("firm-1/job-1", { limit: 1000, offset: 0 });
    assert.deepEqual((data || []).map((e) => e.name).sort(), ["certificates", "checklist", "inspections"]);
    assert.equal((data || []).filter((e) => e.id).length, 0, "every entry is a folder, not a file");
  });

  test("a folder with nothing in it finds nothing rather than failing", async () => {
    const { client } = fakeStorage(PROJECT);
    assert.deepEqual(await listFilesRecursively(client, "certflow-files", "firm-1/job-9"), []);
  });
});

describe("deleting a project's documents", () => {
  test("every file goes, and only that project's", async () => {
    const { client, removed } = fakeStorage(PROJECT);
    const result = await removeFolder(client, "certflow-files", "firm-1/job-1");
    assert.equal(result.removed, 7);
    assert.equal(result.error, undefined);
    assert.equal(removed.length, 7);
    assert.ok(!removed.includes("firm-1/job-2/checklist/item-c/other.pdf"), "another project's file was deleted");
  });

  test("nothing to delete is not an error", async () => {
    const { client } = fakeStorage(PROJECT);
    assert.deepEqual(await removeFolder(client, "certflow-files", "firm-1/job-9"), { removed: 0 });
  });

  // A project with hundreds of photos goes in batches rather than one
  // request large enough to time out.
  test("a large project is deleted in batches, and all of it goes", async () => {
    const many = Array.from({ length: 250 }, (_, i) => `firm-1/job-3/inspections/insp-1/photos/${i}.jpg`);
    const { client, removed } = fakeStorage(many);
    const result = await removeFolder(client, "certflow-files", "firm-1/job-3");
    assert.equal(result.removed, 250);
    assert.equal(removed.length, 250);
  });
});
