import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clientEmailFooter } from "@/lib/emailFooter";

// The one paragraph that appears on every message a firm sends a client.
// It has two jobs: stop them writing into a mailbox nobody opens, and
// give them the way that does reach the office.
describe("the footer on a client's email", () => {
  const firm = { name: "Quality Private Certifiers Pty Ltd", phone: "0404 940 898", email: "info@qpcertifiers.com.au" };

  test("says the address is not monitored and not to reply", () => {
    const html = clientEmailFooter(firm);
    assert.match(html, /not monitored/);
    assert.match(html, /do not reply/i);
  });

  test("offers the phone and the email that are actually read", () => {
    const html = clientEmailFooter(firm);
    assert.match(html, /call us on 0404 940 898/);
    assert.match(html, /<a href="mailto:info@qpcertifiers\.com\.au">info@qpcertifiers\.com\.au<\/a>/);
  });

  test("a firm with only a phone offers only the phone", () => {
    const html = clientEmailFooter({ phone: "02 8772 4022", email: null });
    assert.match(html, /call us on 02 8772 4022/);
    assert.ok(!html.includes("mailto:"));
  });

  // The notice matters more than the contact details: a firm that has
  // recorded neither still must not invite a reply into a dead mailbox.
  test("with no contact details it still says do not reply", () => {
    for (const firmRow of [null, {}, { phone: "  ", email: "" }]) {
      const html = clientEmailFooter(firmRow);
      assert.match(html, /do not reply/i);
      assert.ok(!html.includes("If you need to reach us"), "no dangling sentence with nothing after it");
    }
  });

  test("escapes what the firm typed", () => {
    const html = clientEmailFooter({ phone: "<b>0400</b>", email: "a&b@example.com" });
    assert.ok(!html.includes("<b>0400</b>"));
    assert.match(html, /a&amp;b@example\.com/);
  });
});
