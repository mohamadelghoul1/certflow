import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { summariseTurnaround, summariseConversion, daysBetween, median, type TurnaroundJob, type ConversionQuote } from "@/lib/performance";

const job = (received: string, issued: string, over: Partial<TurnaroundJob> = {}): TurnaroundJob => ({
  id: Math.random().toString(36).slice(2),
  address: "21 Coquet Way",
  pathway: "CDC",
  received,
  issued,
  certifier: "Mohamad El Ghoul",
  ...over,
});

describe("how long a certificate takes", () => {
  test("counts whole days between the application and the issue", () => {
    assert.equal(daysBetween("2026-08-01", "2026-08-15"), 14);
    assert.equal(daysBetween("2026-08-01", "2026-08-01"), 0);
    // Across a daylight-saving change, which is where a naive
    // subtraction gains or loses an hour and rounds wrong.
    assert.equal(daysBetween("2026-10-01", "2026-10-10"), 9);
  });

  // One job that sat waiting on a client for four months would drag an
  // average somewhere that describes no real job.
  test("reports the median, not the average", () => {
    const summary = summariseTurnaround([
      job("2026-08-01", "2026-08-08"), // 7
      job("2026-08-01", "2026-08-11"), // 10
      job("2026-01-01", "2026-05-01"), // 120, the outlier
    ]);
    assert.equal(summary.median, 10);
    assert.equal(summary.fastest, 7);
    assert.equal(summary.slowest, 120);
  });

  test("an even number of jobs takes the middle pair", () => {
    assert.equal(median([4, 6]), 5);
    assert.equal(median([1, 2, 3, 10]), 3, "rounded to a whole day");
    assert.equal(median([]), null);
  });

  test("says what share went out inside a fortnight", () => {
    const summary = summariseTurnaround([job("2026-08-01", "2026-08-08"), job("2026-08-01", "2026-08-15"), job("2026-08-01", "2026-09-01"), job("2026-08-01", "2026-08-05")]);
    assert.equal(summary.withinFortnight, 75);
  });

  // Dates entered the wrong way round say nothing about how long the
  // work took, and would report as a negative turnaround.
  test("ignores a job whose dates run backwards", () => {
    const summary = summariseTurnaround([job("2026-08-20", "2026-08-01"), job("2026-08-01", "2026-08-11")]);
    assert.equal(summary.count, 1);
    assert.equal(summary.median, 10);
  });

  test("a firm with nothing issued yet reports nothing rather than zero", () => {
    const summary = summariseTurnaround([]);
    assert.equal(summary.count, 0);
    assert.equal(summary.median, null);
    assert.equal(summary.withinFortnight, null);
  });

  test("the newest issue comes first", () => {
    const summary = summariseTurnaround([job("2026-08-01", "2026-08-08"), job("2026-08-01", "2026-08-20")]);
    assert.deepEqual(summary.jobs.map((j) => j.issued), ["2026-08-20", "2026-08-08"]);
  });
});

const quote = (status: string, total: number): ConversionQuote => ({
  id: Math.random().toString(36).slice(2),
  status,
  total,
  created_at: "2026-08-01T00:00:00Z",
  address: "21 Coquet Way",
});

describe("how much quoted work is won", () => {
  // A firm that writes a lot of drafts is not a firm that loses a lot of
  // work.
  test("a draft is not a quote until it has been sent", () => {
    const summary = summariseConversion([quote("draft", 5000), quote("accepted", 4000), quote("declined", 3000)]);
    assert.equal(summary.sent, 2);
    assert.equal(summary.rate, 50);
  });

  // A quote still sitting with a client is not a loss yet.
  test("measures against what has been decided, not what is outstanding", () => {
    const summary = summariseConversion([quote("accepted", 4000), quote("sent", 9000), quote("sent", 9000)]);
    assert.equal(summary.rate, 100, "one decided, one won");
    assert.equal(summary.awaiting, 2);
    assert.equal(summary.valueAwaiting, 18000);
  });

  test("adds up what was won, lost and is still out", () => {
    const summary = summariseConversion([quote("accepted", 4000), quote("accepted", 2500), quote("declined", 3000), quote("sent", 1500)]);
    assert.equal(summary.valueWon, 6500);
    assert.equal(summary.valueLost, 3000);
    assert.equal(summary.valueAwaiting, 1500);
    assert.equal(summary.rate, 67);
  });

  test("nothing decided yet reports no rate rather than nought per cent", () => {
    const summary = summariseConversion([quote("sent", 1000)]);
    assert.equal(summary.rate, null);
    assert.equal(summariseConversion([]).rate, null);
  });
});
