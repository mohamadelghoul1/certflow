import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { groupForSigning } from "@/lib/storage";

const waiter = (path: string, expiresIn = 3600) => ({ path, expiresIn, resolve: () => {} });

describe("batching signed links", () => {
  // The whole point: a job page asking for ninety files should send one
  // request, not ninety.
  test("a page's worth of paths becomes a single list", () => {
    const groups = groupForSigning(Array.from({ length: 90 }, (_, i) => waiter(`f/${i}.pdf`)));
    assert.equal(groups.length, 1);
    assert.equal(groups[0].paths.length, 90);
  });

  test("the same file asked for twice is signed once, and both callers still get it", () => {
    const groups = groupForSigning([waiter("plans.pdf"), waiter("plans.pdf"), waiter("cert.pdf")]);
    assert.deepEqual(groups[0].paths, ["plans.pdf", "cert.pdf"], "signed once each");
    assert.equal(groups[0].waiting.length, 3, "but every caller is still waiting to be answered");
  });

  test("links wanted for different lengths of time are kept apart", () => {
    const groups = groupForSigning([waiter("a.pdf", 3600), waiter("b.pdf", 60), waiter("c.pdf", 3600)]);
    assert.equal(groups.length, 2);
    assert.deepEqual(
      groups.map((g) => [g.expiresIn, g.paths]).sort((x, y) => Number(x[0]) - Number(y[0])),
      [
        [60, ["b.pdf"]],
        [3600, ["a.pdf", "c.pdf"]],
      ]
    );
  });

  test("nothing queued groups to nothing", () => {
    assert.deepEqual(groupForSigning([]), []);
  });
});
