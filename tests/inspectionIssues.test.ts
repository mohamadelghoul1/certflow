import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { issuesSection } from "@/lib/inspectionIssues";

describe("the issues section on an inspection", () => {
  test("a failed inspection records issues", () => {
    const s = issuesSection("failed");
    assert.equal(s.show, true);
    assert.equal(s.title, "Issues to record");
  });

  // What a satisfactory inspection is waiting on is a document the
  // builder still owes, not a defect — which is what the report has
  // always called it.
  test("a satisfactory inspection lists what is still to be provided", () => {
    const s = issuesSection("passed_subject_to");
    assert.equal(s.show, true);
    assert.equal(s.title, "Items to be provided");
    assert.match(s.placeholder, /provided/i);
  });

  test("a passed inspection has no issues section at all", () => {
    assert.equal(issuesSection("passed").show, false);
    assert.equal(issuesSection("passed", false).show, false);
  });

  // Nothing already recorded may disappear off the screen: it is still
  // in the record and still prints on the report, so hiding it would be
  // the certifier signing something they can no longer see.
  test("a passed inspection that already has issues still shows them", () => {
    const s = issuesSection("passed", true);
    assert.equal(s.show, true);
    assert.equal(s.title, "Issues recorded");
    assert.match(s.hint || "", /change the outcome/i);
  });

  test("before an outcome is chosen the section is there to type into", () => {
    const s = issuesSection("pending");
    assert.equal(s.show, true);
    assert.equal(s.title, "Issues to record");
    assert.equal(s.hint, undefined);
  });

  test("only a pass ever warns; the others are just doing their job", () => {
    assert.equal(issuesSection("failed").hint, undefined);
    assert.equal(issuesSection("passed_subject_to").hint, undefined);
  });
});

describe("what the add button says", () => {
  // An item still to be provided is not an issue, and a button that
  // calls it one undoes the wording above it.
  test("it matches what is being added", () => {
    assert.equal(issuesSection("failed").addLabel, "Add issue");
    assert.equal(issuesSection("passed_subject_to").addLabel, "Add item");
    assert.equal(issuesSection("pending").addLabel, "Add issue");
    assert.equal(issuesSection("passed", true).addLabel, "Add issue");
  });
});
