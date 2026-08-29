import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { emailSenderSettings } from "@/lib/email";

// Who an email comes from, and where a reply lands. A firm sends from an
// address nobody reads and wants answers at the one they do — and
// without a reply-to, a client pressing Reply writes into a mailbox
// nobody watches.

function withEnv(vars: Record<string, string | undefined>, run: () => void) {
  const before: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    before[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("the address emails go out as", () => {
  test("nothing set is Resend's own address, and says so", () => {
    withEnv({ RESEND_FROM_EMAIL: undefined, RESEND_REPLY_TO: undefined }, () => {
      const s = emailSenderSettings();
      assert.match(s.from, /resend\.dev/);
      assert.equal(s.usingFallbackSender, true, "a firm has to be able to see it is mailing out as nobody");
    });
  });

  test("the firm's own address is used and no longer flagged", () => {
    withEnv({ RESEND_FROM_EMAIL: "QP Certifiers <notifications@qpcertifiers.com.au>" }, () => {
      const s = emailSenderSettings();
      assert.equal(s.from, "QP Certifiers <notifications@qpcertifiers.com.au>");
      assert.equal(s.usingFallbackSender, false);
    });
  });

  // Whitespace round a pasted value is the commonest way one of these
  // arrives, and a From with a stray space is a rejected email.
  test("a value pasted with spaces round it still works", () => {
    withEnv({ RESEND_FROM_EMAIL: "  QP Certifiers <notifications@qpcertifiers.com.au>  " }, () => {
      assert.equal(emailSenderSettings().from, "QP Certifiers <notifications@qpcertifiers.com.au>");
    });
  });

  test("set to nothing at all is the same as not set", () => {
    withEnv({ RESEND_FROM_EMAIL: "   " }, () => {
      assert.equal(emailSenderSettings().usingFallbackSender, true);
    });
  });
});

describe("where a reply lands", () => {
  test("unset, a reply goes to the sender, as it always did", () => {
    withEnv({ RESEND_REPLY_TO: undefined }, () => assert.equal(emailSenderSettings().replyTo, null));
    withEnv({ RESEND_REPLY_TO: "  " }, () => assert.equal(emailSenderSettings().replyTo, null));
  });

  test("set, a reply goes where the firm said", () => {
    withEnv({ RESEND_REPLY_TO: " info@qpcertifiers.com.au " }, () => {
      assert.equal(emailSenderSettings().replyTo, "info@qpcertifiers.com.au");
    });
  });

  // The two are independent: sending as notifications@ and reading
  // replies at info@ is the whole point.
  test("the sending address and the reply address are different things", () => {
    withEnv(
      { RESEND_FROM_EMAIL: "QP Certifiers <notifications@qpcertifiers.com.au>", RESEND_REPLY_TO: "info@qpcertifiers.com.au" },
      () => {
        const s = emailSenderSettings();
        assert.equal(s.from, "QP Certifiers <notifications@qpcertifiers.com.au>");
        assert.equal(s.replyTo, "info@qpcertifiers.com.au");
      },
    );
  });
});
