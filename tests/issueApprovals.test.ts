import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { approvalFor, canIssueNow, isIssueStage, stageLabel, type ApprovalRow } from "@/lib/issueApprovals";

function row(over: Partial<ApprovalRow>): ApprovalRow {
  return {
    id: "a1",
    stage: "pathway",
    status: "pending",
    requested_by: "c2",
    requested_at: "2026-09-01T00:00:00Z",
    request_note: null,
    decided_by: null,
    decided_at: null,
    decision_note: null,
    used_at: null,
    ...over,
  };
}

// A director's sign-off before a team member issues.
describe("where the sign-off is up to", () => {
  test("a director is never asked", () => {
    const state = approvalFor([row({})], "pathway", false);
    assert.equal(state.state, "not-needed");
    assert.equal(canIssueNow(state), true);
  });

  test("nothing asked yet", () => {
    assert.equal(approvalFor([], "pathway", true).state, "none");
    assert.equal(canIssueNow(approvalFor([], "pathway", true)), false);
  });

  test("asked and waiting", () => {
    const state = approvalFor([row({})], "pathway", true);
    assert.equal(state.state, "pending");
    assert.equal(canIssueNow(state), false, "a request is not an approval");
  });

  test("approved and not yet used lets it be issued", () => {
    const state = approvalFor([row({ status: "approved", decided_by: "c1", decided_at: "2026-09-02T00:00:00Z" })], "pathway", true);
    assert.equal(state.state, "approved");
    assert.equal(canIssueNow(state), true);
  });

  test("an approval already spent on an issue does not cover the next one", () => {
    const spent = row({ status: "approved", used_at: "2026-09-02T01:00:00Z" });
    const state = approvalFor([spent], "pathway", true);
    assert.equal(state.state, "none", "the certificate was issued under it — asking again is the way");
    assert.equal(canIssueNow(state), false);
  });

  test("a decline stands, with its note, until it is asked again", () => {
    const state = approvalFor([row({ status: "declined", decided_by: "c1", decided_at: "2026-09-02T00:00:00Z", decision_note: "Portal ref is wrong" })], "pathway", true);
    assert.equal(state.state, "declined");
    assert.equal(canIssueNow(state), false);
    const afterAsking = approvalFor([row({ id: "a2", requested_at: "2026-09-03T00:00:00Z" }), row({ status: "declined", decided_at: "2026-09-02T00:00:00Z" })], "pathway", true);
    assert.equal(afterAsking.state, "pending");
  });

  test("the newest decline is the one shown", () => {
    const state = approvalFor(
      [
        row({ id: "old", status: "declined", decided_at: "2026-09-01T00:00:00Z", decision_note: "first" }),
        row({ id: "new", status: "declined", decided_at: "2026-09-05T00:00:00Z", decision_note: "second" }),
      ],
      "pathway",
      true
    );
    assert.equal(state.state, "declined");
    assert.equal(state.state === "declined" && state.row.decision_note, "second");
  });

  test("an OC's approval is its own — a certificate's does not cover it", () => {
    const rows = [row({ status: "approved", stage: "pathway" })];
    assert.equal(approvalFor(rows, "oc", true).state, "none");
    assert.equal(approvalFor(rows, "pathway", true).state, "approved");
  });
});

describe("what is being issued", () => {
  test("is named the way the certifier would name it", () => {
    assert.equal(stageLabel("pathway", "CDC"), "CDC");
    assert.equal(stageLabel("pathway", "CC"), "CC");
    assert.equal(stageLabel("oc", "CDC"), "Occupation Certificate");
    assert.equal(stageLabel("pathway", "PC_OC"), "certificate", "a PC/OC job issues no certificate of its own");
  });

  test("only the two stages are stages", () => {
    assert.equal(isIssueStage("pathway"), true);
    assert.equal(isIssueStage("oc"), true);
    assert.equal(isIssueStage("noc"), false);
    assert.equal(isIssueStage(undefined), false);
  });
});
