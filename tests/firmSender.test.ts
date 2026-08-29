import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { firmSender } from "@/lib/email";
import { fakeSupabase } from "./helpers/fakeSupabase";

// The sending address was one setting for the whole deployment. Right
// for one firm; wrong the moment there are two — a second firm's clients
// would receive their certificates and invoices apparently from the
// first firm, and every reply would land in the first firm's inbox.

function firmWith(row: Record<string, unknown> | null) {
  return fakeSupabase(() => ({ data: row })).client as unknown as SupabaseClient;
}

function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const before: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    before[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return run().finally(() => {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

const DEPLOYMENT = {
  RESEND_FROM_EMAIL: "QP Certifiers <notifications@qpcertifiers.com.au>",
  RESEND_REPLY_TO: "info@qpcertifiers.com.au",
};

describe("which firm an email comes from", () => {
  test("a firm with its own address sends as itself", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const sender = await firmSender(
        firmWith({ from_email: "Other Certifiers <mail@othercert.com.au>", reply_to_email: "office@othercert.com.au" }),
        "firm-2",
      );
      assert.equal(sender.from, "Other Certifiers <mail@othercert.com.au>");
      assert.equal(sender.replyTo, "office@othercert.com.au");
    });
  });

  // The whole point: nothing of the first firm leaks onto the second
  // firm's mail.
  test("a firm with its own address does not inherit the deployment's reply-to", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const sender = await firmSender(firmWith({ from_email: "Other Certifiers <mail@othercert.com.au>", reply_to_email: null }), "firm-2");
      assert.equal(sender.from, "Other Certifiers <mail@othercert.com.au>");
      assert.equal(
        sender.replyTo,
        null,
        "a second firm's client pressing Reply must not write to the first firm",
      );
    });
  });

  test("a firm that has set nothing behaves exactly as before", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const sender = await firmSender(firmWith({ from_email: null, reply_to_email: null }), "firm-1");
      assert.equal(sender.from, DEPLOYMENT.RESEND_FROM_EMAIL);
      assert.equal(sender.replyTo, DEPLOYMENT.RESEND_REPLY_TO);
    });
  });

  test("blank and whitespace count as not set", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const sender = await firmSender(firmWith({ from_email: "   ", reply_to_email: "" }), "firm-1");
      assert.equal(sender.from, DEPLOYMENT.RESEND_FROM_EMAIL);
    });
  });

  test("a firm may redirect replies without changing who it sends as", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const sender = await firmSender(firmWith({ from_email: null, reply_to_email: "office@othercert.com.au" }), "firm-2");
      assert.equal(sender.from, DEPLOYMENT.RESEND_FROM_EMAIL);
      assert.equal(sender.replyTo, "office@othercert.com.au");
    });
  });

  // A database that has not run 0058 has no such columns, and an email
  // that does not send is worse than one from the wrong name.
  test("a database without the columns still sends", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const sender = await firmSender(firmWith(null), "firm-1");
      assert.equal(sender.from, DEPLOYMENT.RESEND_FROM_EMAIL);
      assert.equal(sender.replyTo, DEPLOYMENT.RESEND_REPLY_TO);
    });
  });

  test("with nothing configured anywhere it is still a valid sender", async () => {
    await withEnv({ RESEND_FROM_EMAIL: undefined, RESEND_REPLY_TO: undefined }, async () => {
      const sender = await firmSender(firmWith(null), "firm-1");
      assert.match(sender.from, /@/);
      assert.equal(sender.replyTo, null);
    });
  });
});
