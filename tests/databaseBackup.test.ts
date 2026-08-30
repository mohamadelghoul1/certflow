import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportFirmDatabase, exportSummary, exportFileName, type FirmExport } from "@/lib/backup/database";
import { fakeSupabase } from "./helpers/fakeSupabase";

// A backup is only worth what it holds on the day it is opened, which is
// years after anybody last looked at it. The two ways it becomes
// worthless are being empty and nobody noticing, and carrying something
// it should never have carried.

const EXPORT: FirmExport = {
  exported_at: "2026-08-30T00:00:00Z",
  firm_id: "firm-1",
  format: "certlyn-firm-export-v1",
  excluded: { tables: ["firm_payment_credentials", "firm_email_credentials"], why: "Live keys are never written to a backup." },
  tables: {
    jobs: [{ id: "job-1", address: "21 Coquet Way" }],
    inspections: [{ id: "i-1", outcome: "passed" }, { id: "i-2", outcome: "failed" }],
    invoices: [],
  },
};

describe("the copy of a firm's records", () => {
  test("counts what it holds, so an empty one can be spotted without opening it", () => {
    assert.deepEqual(exportSummary(EXPORT), { tables: 3, rows: 3 });
  });

  test("an export that has quietly become empty counts as empty", () => {
    assert.deepEqual(exportSummary({ ...EXPORT, tables: { jobs: [], inspections: [] } }), { tables: 2, rows: 0 });
  });

  // The one that matters. Migrations 0059 and 0060 made the Stripe and
  // Resend keys unreadable by anything holding a login; a backup file
  // written to disk and copied to somebody's Dropbox would hand them out
  // by the safest-sounding route available.
  test("the live keys are named as withheld, not quietly missing", () => {
    assert.ok(EXPORT.excluded.tables.includes("firm_payment_credentials"));
    assert.ok(EXPORT.excluded.tables.includes("firm_email_credentials"));
    assert.equal(JSON.stringify(EXPORT).includes("sk_live"), false);
    assert.equal(JSON.stringify(EXPORT).includes("re_"), false);
  });

  test("the file is named by the day it was taken, so a year of them sorts", () => {
    assert.equal(exportFileName(EXPORT, new Date("2026-08-30T10:00:00Z")), "certlyn-records-2026-08-30.json");
  });

  test("a database without migration 0063 says which one to run", async () => {
    const client = fakeSupabase(() => ({ error: { code: "PGRST202", message: "no such function" } })).client as unknown as SupabaseClient;
    const result = await exportFirmDatabase(client, "firm-1");
    assert.ok("error" in result && /0063/.test(result.error));
  });

  test("a firm reaching for another's records is refused by the database, and the refusal is passed on", async () => {
    const client = fakeSupabase(() => ({ error: { code: "P0001", message: "a firm may only export its own records" } })).client as unknown as SupabaseClient;
    const result = await exportFirmDatabase(client, "someone-elses-firm");
    assert.ok("error" in result && /only export its own/.test(result.error));
  });
});
