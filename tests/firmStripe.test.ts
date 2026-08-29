import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { firmStripeCredentials, firmStripeStatus, cardPaymentsAvailable, deploymentStripeConfigured } from "@/lib/payments/stripe";
import { fakeSupabase, type Answer } from "./helpers/fakeSupabase";

// Card payments used to be one Stripe account for the whole deployment.
// Right for one firm, and money in the wrong bank account the moment
// there are two: a second firm's client pressing "Pay online" would pay
// the first firm. These are the rules that stop that.

function credentialsRow(answer: Answer) {
  return fakeSupabase(() => answer).client as unknown as SupabaseClient;
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

const DEPLOYMENT = { STRIPE_SECRET_KEY: "sk_live_deployment", STRIPE_WEBHOOK_SECRET: "whsec_deployment" };
const NO_DEPLOYMENT = { STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined };

describe("which Stripe account a firm's invoices are paid into", () => {
  test("a firm with its own account uses it", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const credentials = await firmStripeCredentials(
        credentialsRow({ data: { stripe_secret_key: "sk_live_firm_b", stripe_webhook_secret: "whsec_firm_b" } }),
        "firm-b"
      );
      assert.equal(credentials.secretKey, "sk_live_firm_b");
      assert.equal(credentials.webhookSecret, "whsec_firm_b");
      assert.equal(credentials.ownAccount, true);
    });
  });

  // The whole point. A payment link created on the deployment's key is
  // paid into the deployment owner's bank account, so a firm that has
  // connected its own must never be handed that key by accident.
  test("a firm with its own account never falls back to the deployment's key", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const credentials = await firmStripeCredentials(
        credentialsRow({ data: { stripe_secret_key: "sk_live_firm_b", stripe_webhook_secret: null } }),
        "firm-b"
      );
      assert.equal(credentials.secretKey, "sk_live_firm_b");
      assert.equal(
        credentials.webhookSecret,
        null,
        "the deployment's signing secret belongs to a different Stripe account and must not be paired with this firm's key"
      );
    });
  });

  test("a firm that has not connected one uses the deployment's", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const credentials = await firmStripeCredentials(credentialsRow({ data: null }), "firm-a");
      assert.equal(credentials.secretKey, "sk_live_deployment");
      assert.equal(credentials.webhookSecret, "whsec_deployment");
      assert.equal(credentials.ownAccount, false);
    });
  });

  // Migration 0059 has not been run yet. Card payments must keep
  // working exactly as they did before rather than stopping dead.
  test("a database without the credentials table falls back to the deployment's", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const credentials = await firmStripeCredentials(credentialsRow({ error: { code: "42P01", message: "no such table" } }), "firm-a");
      assert.equal(credentials.secretKey, "sk_live_deployment");
      assert.equal(credentials.ownAccount, false);
    });
  });

  test("a blank stored key is not a connected account", async () => {
    await withEnv(DEPLOYMENT, async () => {
      const credentials = await firmStripeCredentials(credentialsRow({ data: { stripe_secret_key: "   ", stripe_webhook_secret: "whsec_firm_b" } }), "firm-b");
      assert.equal(credentials.secretKey, "sk_live_deployment");
      assert.equal(credentials.ownAccount, false);
    });
  });

  test("with nothing configured anywhere there is no key to charge against", async () => {
    await withEnv(NO_DEPLOYMENT, async () => {
      const credentials = await firmStripeCredentials(credentialsRow({ data: null }), "firm-a");
      assert.equal(credentials.secretKey, null);
      assert.equal(deploymentStripeConfigured(), false);
    });
  });
});

describe("what Settings is allowed to know", () => {
  // The status is what reaches a browser. It must be booleans and
  // nothing else: a Client Component is handed its props in the page
  // source, so a key here would be published.
  test("reports whether each half is set, never the values", async () => {
    const status = await firmStripeStatus(
      fakeSupabase(() => ({ data: [{ secret_key_set: true, webhook_secret_set: false, updated_at: "2026-08-29T00:00:00Z" }] })).client as unknown as SupabaseClient
    );
    assert.deepEqual(status, { secretKeySet: true, webhookSecretSet: false, updatedAt: "2026-08-29T00:00:00Z", installed: true });
    assert.equal(JSON.stringify(status).includes("sk_"), false);
  });

  test("a database without migration 0059 says so rather than looking disconnected", async () => {
    const status = await firmStripeStatus(fakeSupabase(() => ({ error: { code: "PGRST202", message: "no such function" } })).client as unknown as SupabaseClient);
    assert.equal(status.installed, false);
    assert.equal(status.secretKeySet, false);
  });

  test("a firm with no row is simply not connected", async () => {
    const status = await firmStripeStatus(fakeSupabase(() => ({ data: [] })).client as unknown as SupabaseClient);
    assert.equal(status.installed, true);
    assert.equal(status.secretKeySet, false);
  });
});

describe("whether the Pay online button appears", () => {
  test("shows for a firm with its own account even when Vercel has no Stripe keys", async () => {
    await withEnv(NO_DEPLOYMENT, async () => {
      const available = await cardPaymentsAvailable(
        fakeSupabase(() => ({ data: [{ secret_key_set: true, webhook_secret_set: true }] })).client as unknown as SupabaseClient
      );
      assert.equal(available, true);
    });
  });

  test("hides when neither the firm nor the deployment has an account", async () => {
    await withEnv(NO_DEPLOYMENT, async () => {
      const available = await cardPaymentsAvailable(fakeSupabase(() => ({ data: [] })).client as unknown as SupabaseClient);
      assert.equal(available, false);
    });
  });
});
