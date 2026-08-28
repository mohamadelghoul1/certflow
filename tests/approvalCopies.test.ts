import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { approvalCopiesFor } from "@/lib/approvalCopies";
import { runSystemChecks } from "@/lib/systemCheck";
import { fakeSupabase, type Call } from "./helpers/fakeSupabase";

// A job can carry a copy of its CDC and a copy of each Occupation
// Certificate. Filing one under the wrong certificate would be worse
// than showing none — the whole point of a client's copy is that it is
// the copy of *that* certificate.
describe("splitting a client's copies between certificates", () => {
  const copies = [
    { id: "1", kind: "pathway" as const, oc_record_id: null },
    { id: "2", kind: "oc" as const, oc_record_id: "oc-a" },
    { id: "3", kind: "oc" as const, oc_record_id: "oc-b" },
    { id: "4", kind: "pathway" as const, oc_record_id: null },
  ];

  test("the CDC/CC gets only the copies sent against it", () => {
    assert.deepEqual(
      approvalCopiesFor(copies, "pathway").map((c) => c.id),
      ["1", "4"]
    );
  });

  test("each Occupation Certificate gets its own", () => {
    assert.deepEqual(
      approvalCopiesFor(copies, "oc", "oc-a").map((c) => c.id),
      ["2"]
    );
    assert.deepEqual(
      approvalCopiesFor(copies, "oc", "oc-b").map((c) => c.id),
      ["3"]
    );
  });

  test("an Occupation Certificate with no record named gets none", () => {
    assert.deepEqual(approvalCopiesFor(copies, "oc", null), []);
    assert.deepEqual(approvalCopiesFor(copies, "oc"), []);
  });
});

describe("System check knows about the new database updates", () => {
  test("says so when the client-copy table has not been created", async () => {
    const { client } = fakeSupabase((call: Call) =>
      call.table === "client_approval_copies" ? { error: { code: "PGRST205", message: "no such table" } } : { data: [], error: null }
    );
    const checks = await runSystemChecks(client);
    const found = checks.find((c) => c.migration === "0046");
    assert.ok(found, "0046 is listed");
    assert.equal(found.applied, false);
  });

  test("and about the agreement signature placement, which was never listed", async () => {
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
