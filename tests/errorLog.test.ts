import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normaliseMessage, normaliseRoute, fingerprintFor, shortMessage } from "@/lib/errorLog";
import { sortFaults, faultTone, type FaultRow } from "@/lib/faults";
import { runSystemChecks } from "@/lib/systemCheck";
import { fakeSupabase, type Call } from "./helpers/fakeSupabase";

// Grouping is the whole difference between a fault log and a flood. The
// same fault rarely produces the same words twice — the ids, dates and
// names inside a message are exactly what differ between one occurrence
// and the next.
describe("deciding when two failures are the same failure", () => {
  test("the same fault on two different jobs is one fault", () => {
    const a = fingerprintFor({ source: "server", message: "Job 3f6d9a20-1111-2222-3333-444444444444 not found", route: "/jobs/3f6d9a20-1111-2222-3333-444444444444" });
    const b = fingerprintFor({ source: "server", message: "Job 8c2e1f70-5555-6666-7777-888888888888 not found", route: "/jobs/8c2e1f70-5555-6666-7777-888888888888" });
    assert.equal(a, b);
  });

  test("two genuinely different faults stay apart", () => {
    const a = fingerprintFor({ source: "server", message: "Job not found", route: "/jobs/1" });
    const b = fingerprintFor({ source: "server", message: "Certificate could not be generated", route: "/jobs/1" });
    assert.notEqual(a, b);
  });

  test("the same message on two different pages is two faults", () => {
    const a = fingerprintFor({ source: "server", message: "Not found", route: "/jobs/1" });
    const b = fingerprintFor({ source: "server", message: "Not found", route: "/invoices/1" });
    assert.notEqual(a, b);
  });

  // React hides the real message in production and leaves a digest. When
  // there is one it identifies the fault better than any wording can.
  test("a digest identifies the fault wherever it appears", () => {
    const a = fingerprintFor({ source: "server", message: "An error occurred", route: "/jobs/1", digest: "1927489302" });
    const b = fingerprintFor({ source: "server", message: "different words entirely", route: "/invoices/9", digest: "1927489302" });
    assert.equal(a, b);
  });

  test("a browser failure is never merged with a server one", () => {
    const server = fingerprintFor({ source: "server", message: "Boom", route: "/jobs" });
    const browser = fingerprintFor({ source: "browser", message: "Boom", route: "/jobs" });
    assert.notEqual(server, browser);
  });

  test("strips the parts of a message that differ every time", () => {
    assert.equal(normaliseMessage('Could not read "21 Coquet Way.pdf" after 3 tries'), 'could not read "…" after <n> tries');
    assert.equal(normaliseRoute("/jobs/3f6d9a20-1111-2222-3333-444444444444/oc?tab=2"), "/jobs/:id/oc");
    assert.equal(normaliseRoute("/invoices/42/document"), "/invoices/:n/document");
  });

  test("a long message is cut to something a subject line can carry", () => {
    assert.equal(shortMessage("Line one\nLine two"), "Line one");
    assert.equal(shortMessage("x".repeat(200), 20).length, 20);
    assert.equal(shortMessage(""), "Unknown error");
  });
});

describe("what the Faults page puts first", () => {
  const fault = (over: Partial<FaultRow>): FaultRow =>
    ({
      id: "1",
      source: "server",
      route: "/jobs",
      method: "GET",
      route_type: "render",
      message: "Boom",
      digest: null,
      stack: null,
      occurrences: 1,
      first_seen_at: "2026-08-01T00:00:00Z",
      last_seen_at: "2026-08-01T00:00:00Z",
      resolved_at: null,
      ...over,
    }) as FaultRow;

  test("what is still broken comes before what has been handled", () => {
    const rows = sortFaults([
      fault({ id: "handled-recent", resolved_at: "2026-08-28T00:00:00Z", last_seen_at: "2026-08-28T00:00:00Z" }),
      fault({ id: "open-old", last_seen_at: "2026-08-02T00:00:00Z" }),
    ]);
    assert.deepEqual(
      rows.map((r) => r.id),
      ["open-old", "handled-recent"]
    );
  });

  test("something happening over and over reads differently from a one-off", () => {
    assert.equal(faultTone(fault({ occurrences: 1 })), "open");
    assert.equal(faultTone(fault({ occurrences: 40 })), "repeating");
    assert.equal(faultTone(fault({ occurrences: 40, resolved_at: "2026-08-28T00:00:00Z" })), "handled");
  });
});

describe("System check knows about the fault log", () => {
  test("says so when the table has not been created", async () => {
    const { client } = fakeSupabase((call: Call) => (call.table === "error_events" ? { error: { code: "PGRST205", message: "no such table" } } : { data: [], error: null }));
    const checks = await runSystemChecks(client);
    const found = checks.find((c) => c.migration === "0047");
    assert.ok(found, "0047 is listed");
    assert.equal(found.applied, false);
  });
});
