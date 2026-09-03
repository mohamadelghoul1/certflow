import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { needsSecondFactor, normaliseCode } from "@/lib/twoFactor";

// When the second step is demanded, and what a typed code has to be.
describe("the second step", () => {
  test("is asked for only on a password session of an account with an authenticator", () => {
    assert.equal(needsSecondFactor({ currentLevel: "aal1", nextLevel: "aal2" }), true);
    assert.equal(needsSecondFactor({ currentLevel: "aal2", nextLevel: "aal2" }), false, "already given the code");
    assert.equal(needsSecondFactor({ currentLevel: "aal1", nextLevel: "aal1" }), false, "no authenticator set up");
    assert.equal(needsSecondFactor(null), false);
    assert.equal(needsSecondFactor(undefined), false);
  });

  test("a code is six digits however it was typed", () => {
    assert.equal(normaliseCode("123456"), "123456");
    assert.equal(normaliseCode("123 456"), "123456");
    assert.equal(normaliseCode(" 123-456 "), "123456");
    assert.equal(normaliseCode("12345"), null);
    assert.equal(normaliseCode("1234567"), null);
    assert.equal(normaliseCode("abcdef"), null);
  });
});
