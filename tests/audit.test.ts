import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { recordAuditEvent, getRecordedEvents } from "@/lib/audit";
import { fakeSupabase, argsOf } from "./helpers/fakeSupabase";
import type { Profile } from "@/types/db";

const certifier = { id: "user-1", firm_id: "firm-1", role: "certifier", certifier_id: "c-1", client_id: null, full_name: "Mohamad El Ghoul", email: "m@example.com" } as Profile;

describe("recording what happened", () => {
  test("writes the event with who did it and against which job", async () => {
    const { client, calls } = fakeSupabase(() => ({ error: null }));

    await recordAuditEvent(client, {
      firmId: "firm-1",
      action: "job.deleted",
      summary: "Deleted the project at 21 Coquet Way",
      jobId: "job-1",
      jobAddress: "21 Coquet Way",
      actor: certifier,
      severity: "warning",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].table, "audit_events");
    const [row] = argsOf(calls[0], "insert") as [Record<string, unknown>];
    assert.equal(row.firm_id, "firm-1");
    assert.equal(row.action, "job.deleted");
    assert.equal(row.actor_user_id, "user-1");
    assert.equal(row.actor_name, "Mohamad El Ghoul");
    assert.equal(row.severity, "warning");
    // The address is copied in rather than looked up, because the whole
    // point is that it outlives the job it describes.
    assert.equal(row.job_address, "21 Coquet Way");
  });

  test("an ordinary event is recorded as information", async () => {
    const { client, calls } = fakeSupabase(() => ({ error: null }));
    await recordAuditEvent(client, { firmId: "firm-1", action: "certificate.signed", summary: "Signed the CDC certificate" });
    const [row] = argsOf(calls[0], "insert") as [Record<string, unknown>];
    assert.equal(row.severity, "info");
    assert.equal(row.actor_user_id, null, "a background job has no person behind it");
  });

  test("falls back to the email address when there is no name on the account", async () => {
    const { client, calls } = fakeSupabase(() => ({ error: null }));
    await recordAuditEvent(client, { firmId: "firm-1", action: "job.restored", summary: "Restored", actor: { ...certifier, full_name: null } });
    const [row] = argsOf(calls[0], "insert") as [Record<string, unknown>];
    assert.equal(row.actor_name, "m@example.com");
  });

  // Recording an event must never be the thing that breaks the action it
  // is recording — least of all on a database that has not had the
  // migration run against it yet.
  test("says nothing and carries on when the table is not there", async () => {
    for (const code of ["42P01", "PGRST205", "PGRST106"]) {
      const { client } = fakeSupabase(() => ({ error: { code, message: "no such table" } }));
      await recordAuditEvent(client, { firmId: "firm-1", action: "job.deleted", summary: "Deleted" });
    }
  });

  test("never throws, whatever the database says", async () => {
    const { client } = fakeSupabase(() => ({ error: { code: "23514", message: "check constraint" } }));
    await recordAuditEvent(client, { firmId: "firm-1", action: "job.deleted", summary: "Deleted" });
  });
});

describe("reading the log back", () => {
  test("asks for this firm's events, newest first", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: [{ id: "e-1", summary: "Deleted" }], error: null }));
    const events = await getRecordedEvents(client, "firm-1");

    assert.equal(events.length, 1);
    assert.deepEqual(argsOf(calls[0], "eq"), ["firm_id", "firm-1"]);
    assert.deepEqual(argsOf(calls[0], "order"), ["created_at", { ascending: false }]);
  });

  // The Audit page still has its reconstructed history to show, so a
  // missing table leaves it emptier rather than broken.
  test("comes back empty rather than failing when there is no table yet", async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: { code: "42P01", message: "no such table" } }));
    assert.deepEqual(await getRecordedEvents(client, "firm-1"), []);
  });
});

// The issuance register: sworn to an insurer, so the CSV must survive
// commas in addresses and the default period must be the financial year
// the request means.
import { registerCsv, financialYearStart, REGISTER_COLUMNS, type RegisterRow } from "@/lib/issuanceRegister";

describe("issuance register", () => {
  test("the default period is the current Australian financial year", () => {
    assert.equal(financialYearStart("2026-08-27"), "2026-07-01");
    assert.equal(financialYearStart("2026-06-30"), "2025-07-01");
    assert.equal(financialYearStart("2026-07-01"), "2026-07-01");
  });

  test("a comma or quote in a field stays one Excel cell", () => {
    const row = {
      date: "2026-08-01",
      certType: "CDC",
      certNumber: "CDC-26091/01",
      portalRef: "CFT-1007788",
      address: "21 Coquet Way, Green Valley NSW 2168",
      certifierName: 'Sam "SJ" Certifier',
      classification: "Class 1a, 10a",
      lotSectionDp: "9 / DP253031",
      council: "Liverpool",
      estimatedCost: "450000",
      applicantName: "Build Co",
      ownerName: "Jane Smith",
      principalContractor: "Best Builds Pty Ltd",
      description: "Construction of a two storey dwelling",
    } satisfies RegisterRow;
    const csv = registerCsv([row]);
    const lines = csv.split("\r\n");
    assert.equal(lines.length, 2);
    assert.ok(lines[1].includes('"21 Coquet Way, Green Valley NSW 2168"'));
    assert.ok(lines[1].includes('"Sam ""SJ"" Certifier"'));
    // Every column the requirement names is present, in order.
    assert.equal(REGISTER_COLUMNS.length, 14);
    assert.ok(lines[0].startsWith("Date issued,Type,Certificate no.,Portal CDC/CFT no."));
  });
});
