import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readInterest, validateInterest, interestEmailHtml } from "@/lib/interest";

// The one public form on the site. What is held: a robot is thanked and
// dropped, a person is told what to fix, and nothing they typed can
// become markup in the email.

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("registering interest", () => {
  test("a person with a name, firm and email gets through", () => {
    const fields = readInterest(form({ name: "Jane", firm: "Jane Certifies", email: "jane@example.com" }));
    assert.equal(validateInterest(fields), null);
  });

  test("a robot that filled the hidden box is thanked and ignored", () => {
    const fields = readInterest(form({ name: "x", firm: "y", email: "a@b.co", website: "http://spam" }));
    assert.match(validateInterest(fields) || "", /Thanks/);
  });

  test("a person is told what is missing", () => {
    assert.match(validateInterest(readInterest(form({ firm: "F", email: "a@b.co" }))) || "", /name/);
    assert.match(validateInterest(readInterest(form({ name: "N", firm: "F", email: "not-an-email" }))) || "", /email/);
    assert.match(validateInterest(readInterest(form({ name: "N", email: "a@b.co" }))) || "", /firm/);
  });

  test("long fields are cut, and nothing typed becomes markup", () => {
    const fields = readInterest(form({ name: "N".repeat(500), firm: "<b>Firm</b>", email: "a@b.co", message: "Hello <script>alert(1)</script>" }));
    assert.equal(fields.name.length, 120);
    const html = interestEmailHtml(fields);
    assert.ok(html.includes("&lt;b&gt;Firm&lt;/b&gt;"));
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("Hello &lt;script&gt;"));
  });
});
