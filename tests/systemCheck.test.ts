import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runSystemChecks } from "@/lib/systemCheck";
import { fakeSupabase, type Call } from "./helpers/fakeSupabase";

// A deployment can be running ahead of its SQL, and when it is, features
// quietly do nothing — which looks like a fault in the app rather than a
// step that was missed. These tests are about the page saying so.

function findCheck(checks: { label: string; applied: boolean }[], label: string) {
  const found = checks.find((c) => c.label === label);
  assert.ok(found, `no check called ${label}`);
  return found;
}

describe("checking which database updates have been run", () => {
  test("reports everything applied against an up-to-date database", async () => {
    // One check asks a function for its answer rather than only whether
    // it exists, so an up-to-date database has to give that answer: a
    // Friday enquiry comes back as the Tuesday.
    const { client } = fakeSupabase((call: Call) => {
      if (call.rpc !== "earliest_bookable_inspection_date") return { data: [], error: null };
      // Answer as an up-to-date database would: the Friday enquiry comes
      // back as the Tuesday, the Thursday afternoon one as the Monday.
      const asked = String((call.steps[0]?.args?.[0] as { p_now?: string } | undefined)?.p_now || "");
      return { data: asked.startsWith("2026-08-28") ? "2026-09-01" : "2026-08-31", error: null };
    });
    const checks = await runSystemChecks(client);

    assert.ok(checks.length > 0);
    assert.deepEqual(
      checks.filter((c) => !c.applied),
      []
    );
  });

  test("spots a column the database has never heard of", async () => {
    const { client } = fakeSupabase((call: Call) => {
      const selected = call.steps.find((s) => s.method === "select")?.args[0];
      if (call.table === "jobs" && selected === "deleted_at") return { error: { code: "42703", message: "no such column" } };
      return { data: [], error: null };
    });

    const checks = await runSystemChecks(client);
    assert.equal(findCheck(checks, "Recoverable deletion").applied, false);
    assert.equal(findCheck(checks, "Audit log").applied, true, "and says nothing about the parts that are fine");
  });

  test("spots a table that is not there", async () => {
    const { client } = fakeSupabase((call: Call) => (call.table === "cloud_backup_connections" ? { error: { code: "PGRST205", message: "no such table" } } : { data: [], error: null }));

    const checks = await runSystemChecks(client);
    assert.equal(findCheck(checks, "Cloud backup").applied, false);
  });

  test("spots a function that is not there", async () => {
    const { client } = fakeSupabase((call: Call) => (call.rpc === "merge_job_details" ? { error: { code: "PGRST202", message: "no such function" } } : { data: [], error: null }));

    const checks = await runSystemChecks(client);
    assert.equal(findCheck(checks, "Saving one field without overwriting the rest").applied, false);
  });

  // Every function probed is called for real, and each refuses a caller in
  // the wrong role before touching anything. An error that is not "no such
  // function" therefore means the function is there and did its job.
  test("a function that refuses the caller still counts as present", async () => {
    const { client } = fakeSupabase((call: Call) => (call.rpc ? { error: { code: "P0001", message: "not a client user" } } : { data: [], error: null }));

    const checks = await runSystemChecks(client);
    assert.equal(findCheck(checks, "Client document limit").applied, true);
    assert.equal(findCheck(checks, "Rate limiting").applied, true);
  });
});
