import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatBytes, storageHeadroom, storageLimitBytes } from "@/lib/storageUsage";

// "53 MB" answers half a question. The other half — how much is left —
// needs a limit, and the limit belongs to the Supabase plan rather than
// to anything the database can be asked.

describe("the storage limit", () => {
  function withEnv(value: string | undefined, run: () => void) {
    const before = process.env.STORAGE_LIMIT_GB;
    if (value === undefined) delete process.env.STORAGE_LIMIT_GB;
    else process.env.STORAGE_LIMIT_GB = value;
    try {
      run();
    } finally {
      if (before === undefined) delete process.env.STORAGE_LIMIT_GB;
      else process.env.STORAGE_LIMIT_GB = before;
    }
  }

  test("a gigabyte figure becomes bytes", () => {
    withEnv("1", () => assert.equal(storageLimitBytes(), 1_073_741_824));
    withEnv("8", () => assert.equal(storageLimitBytes(), 8_589_934_592));
    withEnv("0.5", () => assert.equal(storageLimitBytes(), 536_870_912));
  });

  // Nobody has said what the plan allows, so the page says so rather
  // than inventing a number and reporting headroom that may not exist.
  test("nothing set, or nonsense set, is no limit rather than a wrong one", () => {
    withEnv(undefined, () => assert.equal(storageLimitBytes(), null));
    withEnv("", () => assert.equal(storageLimitBytes(), null));
    withEnv("  ", () => assert.equal(storageLimitBytes(), null));
    withEnv("plenty", () => assert.equal(storageLimitBytes(), null));
    withEnv("0", () => assert.equal(storageLimitBytes(), null));
    withEnv("-5", () => assert.equal(storageLimitBytes(), null));
  });
});

describe("what is left", () => {
  const GB = 1_073_741_824;

  test("with no limit there is nothing to say", () => {
    assert.equal(storageHeadroom(53 * 1_048_576, null), null);
    assert.equal(storageHeadroom(53 * 1_048_576, 0), null);
  });

  test("the real case: 53 MB against a gigabyte", () => {
    const h = storageHeadroom(53 * 1_048_576, GB)!;
    assert.equal(h.percent, 5);
    assert.equal(formatBytes(h.remaining), "971 MB");
    assert.equal(h.nearingLimit, false);
    assert.equal(h.full, false);
  });

  // A page that rounds a real amount of use down to 0% tells a firm it
  // has used nothing.
  test("a little use reads as under one per cent, never as none", () => {
    assert.equal(storageHeadroom(4 * 1_048_576, GB)!.percent, 1);
    assert.equal(storageHeadroom(0, GB)!.percent, 0);
  });

  test("four fifths is the warning, not the wall", () => {
    assert.equal(storageHeadroom(0.79 * GB, GB)!.nearingLimit, false);
    assert.equal(storageHeadroom(0.8 * GB, GB)!.nearingLimit, true);
    assert.equal(storageHeadroom(0.8 * GB, GB)!.full, false);
  });

  test("at or over the limit it is full, and never reports space it has not got", () => {
    assert.equal(storageHeadroom(GB, GB)!.full, true);
    const over = storageHeadroom(GB * 1.5, GB)!;
    assert.equal(over.full, true);
    assert.equal(over.remaining, 0, "an overfull plan has no space left, not negative space");
  });
});
