import { test } from "node:test";
import assert from "node:assert/strict";
import { reorderedIds, insertChecklistItems } from "@/lib/checklists";
import type { SupabaseClient } from "@supabase/supabase-js";

test("a document moves one place, leaving the rest in order", () => {
  const list = ["a", "b", "c", "d"];
  assert.deepEqual(reorderedIds(list, "c", "up"), ["a", "c", "b", "d"]);
  assert.deepEqual(reorderedIds(list, "a", "down"), ["b", "a", "c", "d"]);
  assert.deepEqual(list, ["a", "b", "c", "d"], "the original list is never mutated");
});

test("a move that isn't possible writes nothing at all", () => {
  const list = ["a", "b", "c"];
  assert.equal(reorderedIds(list, "a", "up"), null, "the top item cannot go up");
  assert.equal(reorderedIds(list, "c", "down"), null, "the bottom item cannot go down");
  assert.equal(reorderedIds(list, "zzz", "up"), null, "an id that isn't in the list");
  assert.equal(reorderedIds([], "a", "up"), null);
  assert.equal(reorderedIds(["only"], "only", "down"), null);
});

test("two quick presses stack instead of cancelling out", () => {
  let order = ["a", "b", "c", "d"];
  order = reorderedIds(order, "d", "up") ?? order;
  order = reorderedIds(order, "d", "up") ?? order;
  assert.deepEqual(order, ["a", "d", "b", "c"]);
});

// Vercel deploys the moment code is pushed; a migration is run by hand
// afterwards. In that window PostgREST rejects the whole insert over one
// unknown column, which emptied every new project's checklist.
test("checklist items still save when the database is one migration behind", async () => {
  const attempts: Record<string, unknown>[][] = [];
  const supabase = {
    from: () => ({
      insert: (rows: Record<string, unknown>[]) => {
        attempts.push(rows);
        if (rows.some((r) => "template_library_item_id" in r)) {
          return Promise.resolve({ error: { code: "PGRST204", message: "Could not find the 'template_library_item_id' column of 'checklist_items' in the schema cache" } });
        }
        return Promise.resolve({ error: null });
      },
    }),
  } as unknown as SupabaseClient;

  await insertChecklistItems(supabase, [
    { checklist_id: "c1", title: "CDC Application Form", sort_order: 0, template_library_item_id: "lib-1" },
    { checklist_id: "c1", title: "Site Plan", sort_order: 1, template_library_item_id: null },
  ]);

  assert.equal(attempts.length, 2, "it retries rather than giving up");
  assert.deepEqual(
    attempts[1].map((r) => Object.keys(r).sort()),
    [["checklist_id", "sort_order", "title"], ["checklist_id", "sort_order", "title"]],
    "the retry drops only the column the database doesn't have"
  );
});

test("an up-to-date database saves in one attempt, keeping the link", async () => {
  const attempts: Record<string, unknown>[][] = [];
  const supabase = {
    from: () => ({ insert: (rows: Record<string, unknown>[]) => { attempts.push(rows); return Promise.resolve({ error: null }); } }),
  } as unknown as SupabaseClient;
  await insertChecklistItems(supabase, [{ checklist_id: "c1", title: "Site Plan", template_library_item_id: "lib-1" }]);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0][0].template_library_item_id, "lib-1");
});

test("an empty list touches the database at all", async () => {
  let called = false;
  const supabase = { from: () => { called = true; return { insert: () => Promise.resolve({ error: null }) }; } } as unknown as SupabaseClient;
  await insertChecklistItems(supabase, []);
  assert.equal(called, false);
});
