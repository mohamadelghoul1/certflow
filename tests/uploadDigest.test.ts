import { test } from "node:test";
import assert from "node:assert/strict";
import { quietWindowOpen, burstSettled, digestEmail, UPLOAD_QUIET_MINUTES } from "@/lib/uploadDigest";

const now = new Date("2026-08-27T10:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

test("first ever upload may email at once", () => {
  assert.equal(quietWindowOpen(null, now), true);
});

test("a recent email holds the window shut", () => {
  assert.equal(quietWindowOpen(minutesAgo(UPLOAD_QUIET_MINUTES - 1), now), false);
});

test("the window reopens once the quiet period has passed", () => {
  assert.equal(quietWindowOpen(minutesAgo(UPLOAD_QUIET_MINUTES), now), true);
});

test("a burst still going is not settled", () => {
  assert.equal(burstSettled(minutesAgo(2), now), false);
});

test("a burst gone quiet for the full window is settled", () => {
  assert.equal(burstSettled(minutesAgo(UPLOAD_QUIET_MINUTES), now), true);
});

test("one document reads in the singular", () => {
  const { subject, html } = digestEmail([{ item_title: "Architectural Plans", file_name: "plans.pdf" }], "12 Smith St");
  assert.equal(subject, "New document from your client — 12 Smith St");
  assert.ok(html.includes("plans.pdf"));
  assert.ok(html.includes("Architectural Plans"));
  assert.ok(html.includes("It's"));
});

test("several documents read as a counted summary", () => {
  const { subject, html } = digestEmail(
    [
      { item_title: "Architectural Plans", file_name: "plans.pdf" },
      { item_title: "Title Search", file_name: "title.pdf" },
      { item_title: null, file_name: "notes.pdf" },
    ],
    "12 Smith St"
  );
  assert.equal(subject, "3 new documents from your client — 12 Smith St");
  assert.ok(html.includes("3 documents"));
  assert.ok(html.includes("notes.pdf"));
});

test("file names cannot smuggle html into the email", () => {
  const { html } = digestEmail([{ item_title: "<script>x</script>", file_name: "<b>.pdf" }], null);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>.pdf"));
  assert.ok(html.includes("&lt;b&gt;.pdf"));
});
