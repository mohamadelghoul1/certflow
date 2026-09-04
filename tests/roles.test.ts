import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { directorFromAnswer, canChangeRole, teamChanges, staffCanOpen, roleLabel, isFirmRole } from "@/lib/roles";

// Who runs the firm, read from what the database said.
describe("director or team member", () => {
  test("is what is_director() answered", () => {
    assert.equal(directorFromAnswer(true, null), true);
    assert.equal(directorFromAnswer(false, null), false);
  });

  test("is a director when the database cannot say — before 0072, or on a hiccup", () => {
    assert.equal(directorFromAnswer(null, { code: "PGRST202", message: "function not found" }), true, "migration not run yet");
    assert.equal(directorFromAnswer(false, { code: "PGRST301", message: "timeout" }), true, "an error never locks a director out");
    assert.equal(directorFromAnswer(null, null), true, "no answer at all reads as before");
  });

  test("labels an unknown or missing role as Director, which is what every login was", () => {
    assert.equal(roleLabel("staff"), "Team member");
    assert.equal(roleLabel("director"), "Director");
    assert.equal(roleLabel(undefined), "Director");
    assert.equal(isFirmRole("staff"), true);
    assert.equal(isFirmRole("owner"), false);
  });
});

describe("changing a role", () => {
  test("is anyone's but your own", () => {
    assert.equal(canChangeRole("c2", "c1"), true);
    assert.equal(canChangeRole("c1", "c1"), false);
    assert.equal(canChangeRole("c1", null), true, "a login with no card of its own may set anyone's");
  });
});

// The team form: what is there, what was ticked, what changes.
describe("a project's team", () => {
  test("adds the newly ticked and removes the unticked", () => {
    assert.deepEqual(teamChanges(["a", "b"], ["b", "c"], null), { add: ["c"], remove: ["a"] });
  });

  test("changes nothing when nothing changed", () => {
    assert.deepEqual(teamChanges(["a"], ["a"], null), { add: [], remove: [] });
  });

  test("never lists the assigned certifier, who is on the project by assignment", () => {
    assert.deepEqual(teamChanges([], ["lead", "b"], "lead"), { add: ["b"], remove: [] });
    assert.deepEqual(teamChanges(["lead"], ["lead"], "lead"), { add: [], remove: ["lead"] }, "an old row for the lead is tidied away");
  });

  test("ignores blanks", () => {
    assert.deepEqual(teamChanges([], ["", "b"], null), { add: ["b"], remove: [] });
  });
});

describe("where a team member may go", () => {
  test("their projects, the calendar, on site, and their own settings", () => {
    for (const path of ["/dashboard", "/jobs", "/jobs/abc", "/jobs/abc?tab=noc", "/calendar", "/settings", "/site", "/site/xyz"]) {
      assert.equal(staffCanOpen(path), true, path);
    }
  });

  test("not the firm's money, records or setup, nor creating projects", () => {
    for (const path of ["/quotes", "/invoices", "/audit", "/reports", "/compliance", "/jobs/new", "/jobs/import", "/jobs/deleted"]) {
      assert.equal(staffCanOpen(path), false, path);
    }
  });
});
