import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isUnknownColumn, excludingDeleted } from "@/lib/softDelete";

// The app is live the moment it is pushed; the SQL is run by hand
// afterwards. In between, asking for a column the database has never
// heard of would break the projects list outright, so the query is
// tried again without it. These tests are about that gap, because it is
// the one nobody is watching for.
describe("filtering out deleted projects", () => {
  test("recognises the database saying it does not know the column", () => {
    assert.equal(isUnknownColumn({ code: "42703" }), true, "Postgres itself");
    assert.equal(isUnknownColumn({ code: "PGRST204" }), true, "PostgREST rejecting it first");
    assert.equal(isUnknownColumn({ code: "PGRST100" }), true);
  });

  test("does not mistake other failures for it", () => {
    assert.equal(isUnknownColumn(null), false);
    assert.equal(isUnknownColumn(undefined), false);
    assert.equal(isUnknownColumn({ code: "42501" }), false, "permission denied is not a missing column");
    assert.equal(isUnknownColumn({ code: "PGRST116" }), false);
  });

  test("asks for live projects only, once the column is there", async () => {
    const asked: boolean[] = [];
    const result = await excludingDeleted(async (live) => {
      asked.push(live);
      return { data: ["a job"], error: null };
    });

    assert.deepEqual(asked, [true], "one query, filtered");
    assert.deepEqual(result.data, ["a job"]);
  });

  test("falls back to every project when the database has no such column", async () => {
    const asked: boolean[] = [];
    const result = await excludingDeleted(async (live) => {
      asked.push(live);
      return live ? { data: null, error: { code: "42703" } } : { data: ["a job"], error: null };
    });

    assert.deepEqual(asked, [true, false], "tried filtered, then unfiltered");
    assert.deepEqual(result.data, ["a job"], "the page still renders");
  });

  // A permission problem or a bad query is not something a second attempt
  // fixes, and hiding it behind a retry would make it harder to find.
  test("does not retry a failure that is not about the column", async () => {
    let attempts = 0;
    const result = await excludingDeleted(async () => {
      attempts++;
      return { data: null, error: { code: "42501", message: "permission denied" } };
    });

    assert.equal(attempts, 1);
    assert.equal(result.error?.code, "42501", "and the real error is passed on");
  });
});
