import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { sendEmail, DEMO_NOT_SENT } from "@/lib/email";

// The demonstration account exists to be shown to other certifiers. Its
// clients are invented, so the one thing it must never do is send.
describe("a demonstration firm's email", () => {
  test("is refused before anything is sent, and says so", async () => {
    const result = await sendEmail("jordan.taylor@example.com", "Certificate issued", "<p>Hello</p>", undefined, {
      from: "Certlyn Demonstration Certifiers <demo@certlyn.com.au>",
      replyTo: null,
      apiKey: null,
      ownAccount: false,
      demo: true,
    });
    assert.equal(result.sent, false);
    assert.equal(result.skipped, "demo");
    assert.equal(result.error, DEMO_NOT_SENT);
  });

  test("is refused even where the firm has its own Resend account and a real address", async () => {
    const result = await sendEmail("someone@arealfirm.com.au", "Certificate issued", "<p>Hello</p>", undefined, {
      from: "Their Firm <notifications@arealfirm.com.au>",
      replyTo: "office@arealfirm.com.au",
      apiKey: "re_not_a_real_key",
      ownAccount: true,
      demo: true,
    });
    assert.equal(result.sent, false, "the key is never even handed to the mail service");
    assert.equal(result.skipped, "demo");
  });

  test("a firm that is not a demonstration is not affected by the check", async () => {
    // No Resend key is configured in tests, so a normal firm gets the
    // ordinary "not configured" answer rather than the demo one.
    const result = await sendEmail("client@example.com", "Certificate issued", "<p>Hello</p>", undefined, {
      from: "Their Firm <notifications@arealfirm.com.au>",
      replyTo: null,
      apiKey: null,
      ownAccount: false,
      demo: false,
    });
    assert.notEqual(result.skipped, "demo");
  });
});
