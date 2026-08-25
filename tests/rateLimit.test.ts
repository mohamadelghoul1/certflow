import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { withinLimit, loginBucket, downloadBucket, LOGIN_LIMIT, HEAVY_DOWNLOAD_LIMIT } from "@/lib/rateLimit";
import { fakeSupabase, argsOf } from "./helpers/fakeSupabase";

describe("the limit on how often something can be done", () => {
  test("passes the bucket and the window to the database", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: true, error: null }));
    await withinLimit(client, "login:m@example.com", LOGIN_LIMIT);

    assert.equal(calls[0].rpc, "record_rate_limit_hit");
    assert.deepEqual(argsOf(calls[0], "rpc"), [{ p_bucket: "login:m@example.com", p_window_seconds: 60, p_limit: 10 }]);
  });

  test("lets the caller through while it is inside its allowance", async () => {
    const { client } = fakeSupabase(() => ({ data: true, error: null }));
    assert.equal(await withinLimit(client, "download:user-1", HEAVY_DOWNLOAD_LIMIT), true);
  });

  test("turns the caller away once it is past it", async () => {
    const { client } = fakeSupabase(() => ({ data: false, error: null }));
    assert.equal(await withinLimit(client, "download:user-1", HEAVY_DOWNLOAD_LIMIT), false);
  });

  // A database that has not had migration 0028 run against it has no such
  // function. A missing rate limit must never be the thing that stops
  // someone signing in.
  test("lets everyone through when the counter does not exist yet", async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: { code: "PGRST202", message: "no such function" } }));
    assert.equal(await withinLimit(client, "login:m@example.com", LOGIN_LIMIT), true);
  });
});

describe("what the counting is keyed on", () => {
  // Keyed on the address rather than on the app as a whole, so one
  // account being guessed at cannot lock everybody else out.
  test("a sign-in is counted per email address, however it was typed", () => {
    assert.equal(loginBucket("M@Example.com"), "login:m@example.com");
    assert.equal(loginBucket("  m@example.com  "), "login:m@example.com");
    assert.notEqual(loginBucket("someone@else.com"), loginBucket("m@example.com"));
  });

  test("a download is counted against whoever asked for it", () => {
    assert.equal(downloadBucket("user-1"), "download:user-1");
    assert.notEqual(downloadBucket("user-1"), loginBucket("user-1"));
  });
});
