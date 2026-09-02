import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { purgeCutoff, runDeletedJobPurge, PURGE_AFTER_DAYS } from "@/lib/deletedJobsPurge";
import { fakeSupabase, argsOf } from "./helpers/fakeSupabase";

// Deleted projects go for good after thirty days, files first.

describe("the purge cutoff", () => {
  test("is thirty days before now", () => {
    assert.equal(PURGE_AFTER_DAYS, 30);
    assert.equal(purgeCutoff("2026-09-30T06:00:00.000Z"), "2026-08-31T06:00:00.000Z");
  });
});

describe("the morning purge", () => {
  function run(jobs: unknown[], storageFails = false) {
    const removed: string[] = [];
    const deleted: string[] = [];
    const audits: string[] = [];
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "jobs" && call.steps.some((s) => s.method === "select")) return { data: jobs };
      if (call.table === "jobs" && call.steps.some((s) => s.method === "delete")) {
        deleted.push(String(argsOf(call, "eq")?.[1]));
        return { data: null };
      }
      if (call.table === "audit_events" || call.table === "audit_log") {
        audits.push(String((argsOf(call, "insert")?.[0] as { summary?: string })?.summary));
        return { data: null };
      }
      return { data: null };
    });
    // Storage is not a table; the fake client grows a storage facade
    // that answers a listing with one file and a removal that succeeds
    // or fails as the test says.
    (client as unknown as { storage: unknown }).storage = {
      from: () => ({
        list: async (prefix: string) => ({ data: prefix.split("/").length > 2 ? [{ name: "plan.pdf", id: "f1", metadata: { size: 10 } }] : [{ name: "checklist", id: null, metadata: null }], error: null }),
        remove: async (paths: string[]) => {
          removed.push(...paths);
          return { error: storageFails ? { message: "storage down" } : null };
        },
      }),
    };
    return { client, calls, removed, deleted, audits };
  }

  test("asks only for projects deleted before the cutoff", async () => {
    const { client, calls } = run([]);
    await runDeletedJobPurge(client, "2026-09-30T06:00:00.000Z");
    const query = calls.find((c) => c.table === "jobs")!;
    assert.deepEqual(argsOf(query, "not"), ["deleted_at", "is", null]);
    assert.deepEqual(argsOf(query, "lt"), ["deleted_at", "2026-08-31T06:00:00.000Z"]);
  });

  test("removes the files, then the row, then writes it down", async () => {
    const { client, removed, deleted, audits } = run([{ id: "job-1", firm_id: "firm-1", address: "21 Coquet Way", deleted_at: "2026-07-01T00:00:00Z" }]);
    const outcome = await runDeletedJobPurge(client, "2026-09-30T06:00:00.000Z");
    assert.equal(outcome.purged, 1);
    assert.ok(removed.length > 0, "the project's files were removed");
    assert.deepEqual(deleted, ["job-1"]);
    assert.ok(audits.some((a) => a.includes("21 Coquet Way") && a.includes("30 days")));
  });

  // A project whose files could not be removed keeps its row, so the
  // sweep comes back for it rather than leaving documents nothing can
  // reach — the exact orphaning this exists to prevent.
  test("keeps the row when the files could not be removed", async () => {
    const { client, deleted, audits } = run([{ id: "job-1", firm_id: "firm-1", address: "21 Coquet Way", deleted_at: "2026-07-01T00:00:00Z" }], true);
    const outcome = await runDeletedJobPurge(client, "2026-09-30T06:00:00.000Z");
    assert.equal(outcome.failed, 1);
    assert.deepEqual(deleted, []);
    assert.deepEqual(audits, []);
  });
});
