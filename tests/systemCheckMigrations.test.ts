import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runSystemChecks } from "@/lib/systemCheck";
import { fakeSupabase, type Call } from "./helpers/fakeSupabase";

// A database update that System check doesn't know about is one the page
// stays silent on — the feature quietly does nothing and nothing says
// why. 0045 was in that position: the migration existed, the page never
// mentioned it.
describe("System check covers the newest database updates", () => {
  test("says so when the agreement signature placement has not been run", async () => {
    const { client } = fakeSupabase((call: Call) => {
      const selected = call.steps.find((s) => s.method === "select")?.args[0];
      if (call.table === "engagement_agreements" && selected === "signature_page") return { error: { code: "42703", message: "no such column" } };
      return { data: [], error: null };
    });

    const checks = await runSystemChecks(client);
    const found = checks.find((c) => c.migration === "0045");
    assert.ok(found, "0045 is listed");
    assert.equal(found.applied, false);
  });
});
