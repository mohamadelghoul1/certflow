import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { roleFromAnswer, canWriteJob, canChangeRole, teamChanges, staffCanOpen, roleLabel, isFirmRole } from "@/lib/roles";

// Who runs the firm, read off the person's own certifier card.
describe("director, team member or inspector", () => {
  test("is what the card says", () => {
    assert.equal(roleFromAnswer("director", null), "director");
    assert.equal(roleFromAnswer("staff", null), "staff");
    assert.equal(roleFromAnswer("inspector", null), "inspector");
  });

  test("is a director when the database cannot say — before 0072, or on a hiccup", () => {
    assert.equal(roleFromAnswer(undefined, { code: "42703", message: "column does not exist" }), "director", "migration not run yet");
    assert.equal(roleFromAnswer("staff", { code: "PGRST301", message: "timeout" }), "director", "an error never locks a director out");
    assert.equal(roleFromAnswer("owner", null), "director", "an unknown value reads as what every login was");
    assert.equal(roleFromAnswer(null, null), "director");
  });

  test("labels the roles, and an unknown one as Director", () => {
    assert.equal(roleLabel("staff"), "Team member");
    assert.equal(roleLabel("inspector"), "Inspector");
    assert.equal(roleLabel("director"), "Director");
    assert.equal(roleLabel(undefined), "Director");
    assert.equal(isFirmRole("inspector"), true);
    assert.equal(isFirmRole("owner"), false);
  });

  test("an inspector reads the project; the others change it", () => {
    assert.equal(canWriteJob("director"), true);
    assert.equal(canWriteJob("staff"), true);
    assert.equal(canWriteJob("inspector"), false);
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
