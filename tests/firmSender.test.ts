import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { firmSender, firmEmailStatus, sendEmail } from "@/lib/email";
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

// Setting the address is only half of it. Resend will only send from a
// domain verified in the account whose key is used, so a second firm
// that types its own address while sending through this deployment's
// account either gets rejected or, worse, quietly goes out as the first
// firm. Its own account is what makes its own name real.

const OWN_KEY = fakeSupabase(() => ({ data: { resend_api_key: "re_their_own_key" } })).client as unknown as SupabaseClient;
const NO_KEY = fakeSupabase(() => ({ data: null })).client as unknown as SupabaseClient;
const NO_TABLE = fakeSupabase(() => ({ error: { code: "42P01", message: "no such table" } })).client as unknown as SupabaseClient;

describe("which Resend account a firm's mail leaves through", () => {
  test("a firm with its own account sends through it, as itself", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const sender = await firmSender(firmWith({ from_email: "Other Certifiers <mail@othercert.com.au>", reply_to_email: null }), "firm-2", OWN_KEY);
      assert.equal(sender.apiKey, "re_their_own_key");
      assert.equal(sender.ownAccount, true);
      assert.equal(sender.from, "Other Certifiers <mail@othercert.com.au>");
    });
  });

  // The rule this whole thing exists for. A firm on its own Resend
  // account must never be handed the deployment's address: their account
  // could not send it anyway, and sending it is exactly the thing —
  // another firm's name on their client's email — being prevented.
  test("a firm with its own account is never given the deployment's address", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const sender = await firmSender(firmWith({ from_email: null, reply_to_email: null }), "firm-2", OWN_KEY);
      assert.equal(sender.from, "", "a second firm's client must never see the first firm's name");
      assert.equal(sender.replyTo, null, "nor have their reply land in the first firm's inbox");
    });
  });

  // And it refuses rather than falling back, so the certifier is told
  // instead of the client being misled.
  test("that firm's mail does not go out at all until it sets its own address", async () => {
    const result = await sendEmail("client@example.com", "Subject", "<p>Body</p>", undefined, {
      from: "",
      replyTo: null,
      apiKey: "re_their_own_key",
      ownAccount: true,
    });
    assert.equal(result.sent, false);
    assert.match(result.error || "", /sending address/i);
  });

  test("a firm without its own account uses the deployment's, as before", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const sender = await firmSender(firmWith({ from_email: null, reply_to_email: null }), "firm-1", NO_KEY);
      assert.equal(sender.apiKey, null);
      assert.equal(sender.ownAccount, false);
      assert.equal(sender.from, DEPLOYMENT.RESEND_FROM_EMAIL);
    });
  });

  test("a database without migration 0060 keeps sending exactly as it did", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const sender = await firmSender(firmWith({ from_email: null, reply_to_email: null }), "firm-1", NO_TABLE);
      assert.equal(sender.apiKey, null);
      assert.equal(sender.from, DEPLOYMENT.RESEND_FROM_EMAIL);
    });
  });

  test("Settings is told whether a key is set and never the key", async () => {
    const status = await firmEmailStatus(
      fakeSupabase(() => ({ data: [{ api_key_set: true, updated_at: "2026-08-29T00:00:00Z" }] })).client as unknown as SupabaseClient
    );
    assert.deepEqual(status, { apiKeySet: true, updatedAt: "2026-08-29T00:00:00Z", installed: true });
    assert.equal(JSON.stringify(status).includes("re_"), false);
  });

  test("a database without migration 0060 says so rather than looking disconnected", async () => {
    const status = await firmEmailStatus(fakeSupabase(() => ({ error: { code: "PGRST202", message: "no such function" } })).client as unknown as SupabaseClient);
    assert.equal(status.installed, false);
    assert.equal(status.apiKeySet, false);
  });
});
