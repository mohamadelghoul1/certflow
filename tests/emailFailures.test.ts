import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { notifyJobClient, notifyJobCertifier, emailConfigured } from "@/lib/email";
import { fakeSupabase, argsOf, type Call } from "./helpers/fakeSupabase";

// A notification that never went out is worse than an error, because the
// certifier believes the client has been told. These are about the app
// noticing.

function selectedColumns(call: Call): string {
  return String(call.steps.find((s) => s.method === "select")?.args[0] || "");
}

function auditRows(calls: Call[]) {
  return calls.filter((c) => c.table === "audit_events").map((c) => (argsOf(c, "insert") as [Record<string, unknown>])[0]);
}

describe("a client who cannot be emailed", () => {
  test("is recorded against the job, as an error", async () => {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "jobs") return { data: { firm_id: "firm-1", address: "21 Coquet Way", client_id: "client-1" }, error: null };
      if (call.table === "clients") return { data: { name: "Sam Owner", email: null }, error: null };
      return { error: null };
    });

    await notifyJobClient(client, "job-1", "Your CDC has been issued", "<p>body</p>");

    const [event] = auditRows(calls);
    assert.ok(event, "nothing was recorded at all");
    assert.equal(event.action, "email.failed");
    assert.equal(event.severity, "error");
    assert.equal(event.job_address, "21 Coquet Way");
    assert.match(String(event.summary), /Sam Owner/);
    assert.match(String(event.summary), /no email address on file/);
    // What the email was about, so the entry is worth reading later.
    assert.deepEqual(event.detail, { subject: "Your CDC has been issued", reason: "no email address on file" });
  });

  // A job with nobody attached to it is not a failure — there was nobody
  // to tell — and filling the log with those would bury the real ones.
  test("a project with no client attached records nothing", async () => {
    const { client, calls } = fakeSupabase((call) => (call.table === "jobs" ? { data: { firm_id: "firm-1", address: "21 Coquet Way", client_id: null }, error: null } : { error: null }));

    await notifyJobClient(client, "job-1", "Your CDC has been issued", "<p>body</p>");
    assert.deepEqual(auditRows(calls), []);
  });

  // The firm has to be known, or there is nowhere to file the entry.
  test("the job is read for its firm as well as its client", async () => {
    const { client, calls } = fakeSupabase((call) => (call.table === "jobs" ? { data: { firm_id: "firm-1", address: "x", client_id: null }, error: null } : { error: null }));
    await notifyJobClient(client, "job-1", "subject", "<p>body</p>");
    assert.match(selectedColumns(calls[0]), /firm_id/);
  });
});

describe("a certifier who cannot be emailed", () => {
  test("is recorded the same way", async () => {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "jobs") return { data: { firm_id: "firm-1", address: "21 Coquet Way", assigned_certifier_id: "cert-1" }, error: null };
      if (call.table === "certifiers") return { data: { name: "Mohamad El Ghoul", user_id: "user-1" }, error: null };
      if (call.table === "profiles") return { data: { email: null }, error: null };
      return { error: null };
    });

    await notifyJobCertifier(client, "job-1", "A client booked an inspection", "<p>body</p>");

    const [event] = auditRows(calls);
    assert.ok(event);
    assert.equal(event.action, "email.failed");
    assert.match(String(event.summary), /Mohamad El Ghoul/);
  });
});

describe("whether email is switched on at all", () => {
  // With no key configured, nothing is ever sent. The app says so on the
  // Settings page rather than letting a certifier assume otherwise.
  test("reports honestly", () => {
    assert.equal(emailConfigured(), !!process.env.RESEND_API_KEY);
  });
});
