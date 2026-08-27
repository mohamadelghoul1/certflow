import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewEmail } from "@/lib/reviewDigest";

test("one approval reads in the singular", () => {
  const { subject, html } = reviewEmail([{ item_title: "Survey Plan", kind: "approved", note: null }], "12 Smith St");
  assert.equal(subject, "Document approved — 12 Smith St");
  assert.ok(html.includes("Survey Plan"));
  assert.ok(!html.includes("Changes requested"));
});

test("several approvals read as a count", () => {
  const { subject } = reviewEmail(
    [
      { item_title: "Survey Plan", kind: "approved", note: null },
      { item_title: "Title Search", kind: "approved", note: null },
    ],
    null
  );
  assert.equal(subject, "2 documents approved");
});

test("any requested change leads the subject", () => {
  const { subject, html } = reviewEmail(
    [
      { item_title: "Survey Plan", kind: "approved", note: null },
      { item_title: "Architectural Plans", kind: "changes", note: "provide additional survey layout" },
    ],
    "12 Smith St"
  );
  assert.equal(subject, "Changes requested on your documents — 12 Smith St");
  assert.ok(html.includes("Approved"));
  assert.ok(html.includes("Changes requested"));
  assert.ok(html.includes("provide additional survey layout"));
  assert.ok(html.includes("upload the corrected documents"));
});

test("notes cannot smuggle html into the email", () => {
  const { html } = reviewEmail([{ item_title: "<b>Plans</b>", kind: "changes", note: "<script>x</script>" }], null);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>Plans</b>"));
});
