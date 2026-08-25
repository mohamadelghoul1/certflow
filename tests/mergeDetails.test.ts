import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mergeJobDetailsInDb } from "@/lib/actions/mergeDetails";
import { fakeSupabase, argsOf, type Call } from "./helpers/fakeSupabase";

describe("changing part of a project's details", () => {
  test("sends only the change, and reads nothing first", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: {}, error: null }));

    await mergeJobDetailsInDb(client, "job-1", "firm-1", { siteSensitivities: ["Bushfire prone land"] });

    assert.equal(calls.length, 1, "one round trip, not a read and then a write");
    assert.equal(calls[0].rpc, "merge_job_details");
    assert.deepEqual(argsOf(calls[0], "rpc"), [{ p_job_id: "job-1", p_patch: { siteSensitivities: ["Bushfire prone land"] } }]);
  });

  // Before migration 0029 there is no such function, and the app has to
  // keep working on a database running behind the deployment.
  test("falls back to reading and writing when the database has no merge yet", async () => {
    const { client, calls } = fakeSupabase((call: Call) => {
      if (call.rpc) return { error: { code: "PGRST202", message: "no such function" } };
      if (call.steps.some((s) => s.method === "select")) return { data: { details: { projectNumber: "J-1", certificateDetails: { lotSectionDp: "9 / DP1" } } }, error: null };
      return { error: null };
    });

    await mergeJobDetailsInDb(client, "job-1", "firm-1", { certificateDetails: { planningPortalRef: "PAN-9" } });

    const write = calls.find((c) => c.steps.some((s) => s.method === "update"));
    assert.ok(write, "nothing was written");
    const [row] = argsOf(write, "update") as [Record<string, unknown>];
    // The fallback merges the same way the database would, so the field it
    // was not asked to change survives.
    assert.deepEqual(row.details, {
      projectNumber: "J-1",
      certificateDetails: { lotSectionDp: "9 / DP1", planningPortalRef: "PAN-9" },
    });
  });

  test("the fallback stays inside the firm", async () => {
    const { client, calls } = fakeSupabase((call: Call) => {
      if (call.rpc) return { error: { code: "42883", message: "no such function" } };
      return { data: { details: {} }, error: null };
    });

    await mergeJobDetailsInDb(client, "job-1", "firm-1", { zoning: "R3" });

    for (const call of calls.filter((c) => c.table === "jobs")) {
      const scoped = call.steps.filter((s) => s.method === "eq").map((s) => s.args);
      assert.ok(
        scoped.some(([column, value]) => column === "firm_id" && value === "firm-1"),
        "a query went out without the firm on it"
      );
    }
  });

  // A real failure has to surface rather than being papered over by a
  // silent second attempt that writes stale data.
  test("a genuine failure is reported, not retried", async () => {
    const { client, calls } = fakeSupabase(() => ({ error: { code: "42501", message: "permission denied" } }));

    await assert.rejects(() => mergeJobDetailsInDb(client, "job-1", "firm-1", { zoning: "R3" }), /permission denied/);
    assert.equal(calls.length, 1);
  });
});
