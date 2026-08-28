import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBytes } from "@/lib/storageUsage";

test("sizes read the way a person would say them", () => {
  assert.equal(formatBytes(0), "0 MB");
  assert.equal(formatBytes(500 * 1024), "500 KB");
  assert.equal(formatBytes(3.5 * 1_048_576), "3.5 MB");
  assert.equal(formatBytes(250 * 1_048_576), "250 MB");
  assert.equal(formatBytes(2.5 * 1024 * 1_048_576), "2.50 GB");
});
