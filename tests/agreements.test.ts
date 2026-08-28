import { test } from "node:test";
import assert from "node:assert/strict";
import { agreementProgress, progressLabel, nameMatches, newSignatureToken } from "@/lib/agreements";

const party = (name: string, signed: boolean) => ({
  id: name,
  name,
  email: `${name}@example.com`,
  role: "Owner",
  signed_at: signed ? "2026-08-28T00:00:00Z" : null,
  signed_name: signed ? name : null,
});

test("an agreement is complete only when everyone has signed", () => {
  assert.equal(agreementProgress([party("A", true), party("B", false)]).complete, false);
  assert.equal(agreementProgress([party("A", true), party("B", true)]).complete, true);
});

test("an agreement with nobody named is not complete", () => {
  const progress = agreementProgress([]);
  assert.equal(progress.complete, false);
  assert.equal(progressLabel(progress), "No signatories added yet");
});

test("progress reads plainly", () => {
  assert.equal(progressLabel(agreementProgress([party("A", true), party("B", false)])), "1 of 2 signed");
});

test("outstanding names who is still holding it up", () => {
  const progress = agreementProgress([party("A", true), party("B", false)]);
  assert.deepEqual(progress.outstanding.map((s) => s.name), ["B"]);
});

test("a signed name is matched forgivingly", () => {
  assert.equal(nameMatches("Robert Smith", "robert smith"), true);
  assert.equal(nameMatches("Robert Smith", "Robert J Smith"), true);
  assert.equal(nameMatches("Robert Smith", "  Robert   Smith  "), true);
  assert.equal(nameMatches("Robert Smith", "Bob Smith"), false);
  assert.equal(nameMatches("Robert Smith", ""), false);
});

test("tokens are long, unguessable and safe in a link", () => {
  const token = newSignatureToken();
  assert.ok(token.length >= 40);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(token, newSignatureToken());
});
