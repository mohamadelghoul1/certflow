import { test } from "node:test";
import assert from "node:assert/strict";
import { certificatesDownloadable, accessClosesAt, wholeOcIssuedAt, CERTIFICATE_ACCESS_DAYS } from "@/lib/portalAccess";

const whole = (date: string) => ({ type: "whole" as const, generated_date: date });
const partial = (date: string) => ({ type: "partial" as const, generated_date: date });
const daysAfter = (date: string, days: number) => new Date(new Date(date).getTime() + days * 86_400_000);

test("a job with no occupation certificate stays open", () => {
  assert.equal(certificatesDownloadable([]), true);
  assert.equal(accessClosesAt([]), null);
});

test("a partial occupation certificate does not start the clock", () => {
  assert.equal(wholeOcIssuedAt([partial("2026-01-01")]), null);
  assert.equal(certificatesDownloadable([partial("2026-01-01")], new Date("2027-01-01")), true);
});

test("downloads stay open through the grace period", () => {
  const records = [whole("2026-08-01")];
  assert.equal(certificatesDownloadable(records, daysAfter("2026-08-01", 0)), true);
  assert.equal(certificatesDownloadable(records, daysAfter("2026-08-01", CERTIFICATE_ACCESS_DAYS - 1)), true);
});

test("downloads close once the grace period has passed", () => {
  const records = [whole("2026-08-01")];
  assert.equal(certificatesDownloadable(records, daysAfter("2026-08-01", CERTIFICATE_ACCESS_DAYS)), false);
  assert.equal(certificatesDownloadable(records, daysAfter("2026-08-01", 60)), false);
});

test("re-issuing a whole certificate cannot extend the window", () => {
  // The earliest whole OC starts the clock, so a corrected copy issued
  // later doesn't hand the client another three weeks.
  const records = [whole("2026-08-01"), whole("2026-08-20")];
  assert.equal(wholeOcIssuedAt(records), "2026-08-01");
  assert.equal(certificatesDownloadable(records, daysAfter("2026-08-01", 30)), false);
});

test("a whole certificate with no issue date falls back to when it was created", () => {
  const records = [{ type: "whole" as const, generated_date: null, created_at: "2026-08-01T00:00:00Z" }];
  assert.equal(certificatesDownloadable(records, daysAfter("2026-08-01", 30)), false);
});
