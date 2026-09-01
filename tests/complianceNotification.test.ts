import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getComplianceItems } from "@/lib/compliance";
import { fakeSupabase } from "./helpers/fakeSupabase";

// The neighbour notification on the compliance clock: a hold on the job
// while it runs, gone the moment it has passed or the certificate is
// issued — the clock is only worth opening while everything on it is
// really a deadline.

function clientWith(job: Record<string, unknown>) {
  return fakeSupabase((call) => {
    switch (call.table) {
      case "jobs":
        return { data: [job] };
      case "certifiers":
        return { data: [] };
      case "invoices":
        return { data: [] };
      default:
        return { data: null };
    }
  }).client;
}

const job = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  address: "21 Coquet Way, Green Valley",
  pathway: "CDC",
  pathway_approval_date: null,
  pathway_generated: false,
  details: { neighbourNotification: { start: "2026-09-04", end: "2026-09-24" } },
  checklists: [],
  inspections: [],
  ...overrides,
});

describe("the notification period on the compliance clock", () => {
  test("a running period is a dated deadline pointing at the job", async () => {
    const items = await getComplianceItems(clientWith(job()), "firm-1", "2026-09-10");
    const row = items.find((i) => i.title === "Neighbour notification period ends");
    assert.ok(row, "the running notification should be on the clock");
    assert.equal(row.dueDate, "2026-09-24");
    assert.ok(row.detail.includes("the CDC cannot be determined"));
    assert.equal(row.href, "/jobs/job-1?tab=pathway");
  });

  test("a period that has passed is permission, not a deadline", async () => {
    const items = await getComplianceItems(clientWith(job()), "firm-1", "2026-09-25");
    assert.ok(!items.some((i) => i.title === "Neighbour notification period ends"));
  });

  test("an issued certificate takes the row with it", async () => {
    const items = await getComplianceItems(clientWith(job({ pathway_generated: true })), "firm-1", "2026-09-10");
    assert.ok(!items.some((i) => i.title === "Neighbour notification period ends"));
  });

  test("a job with no dates recorded shows nothing", async () => {
    const items = await getComplianceItems(clientWith(job({ details: {} })), "firm-1", "2026-09-10");
    assert.ok(!items.some((i) => i.title === "Neighbour notification period ends"));
  });
});
