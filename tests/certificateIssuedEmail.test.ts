import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { certificateIssuedEmail } from "@/lib/certificateIssuedEmail";

// A CDC is not permission to start building. The old email said only
// that the certificate had been issued, which a client reads as "go
// ahead" — and the first anyone hears of it is a call about work already
// underway.
describe("the certificate-issued email", () => {
  const outstanding = ["Home Building Compensation Fund certificate", "Owner Builder Permit", "Signed contract with the builder"];

  test("names the site in the subject, so a client with two projects knows which", () => {
    const { subject } = certificateIssuedEmail({ pathway: "CDC", address: "21 Coquet Way, Green Valley", firmName: "QP Certifiers", outstanding });
    assert.equal(subject, "CDC issued — 21 Coquet Way, Green Valley");
  });

  test("says what has been issued, in full, and where to get it", () => {
    const { html } = certificateIssuedEmail({ pathway: "CDC", address: "21 Coquet Way", firmName: "QP Certifiers", outstanding });
    assert.ok(html.includes("Complying Development Certificate"));
    assert.ok(html.includes("21 Coquet Way"));
    assert.ok(html.includes("download from your portal"));
    assert.ok(html.includes("QP Certifiers"), "signed off by the firm");
  });

  test("lists what is still required before the Notice of Commencement", () => {
    const { html } = certificateIssuedEmail({ pathway: "CDC", address: "21 Coquet Way", outstanding });
    assert.ok(html.includes("Notice of Commencement of Work"));
    for (const item of outstanding) assert.ok(html.includes(item), `${item} is named`);
  });

  // The sentence the whole email exists for.
  test("says work must not start until the Notice of Commencement is issued", () => {
    const { html } = certificateIssuedEmail({ pathway: "CC", address: "21 Coquet Way", outstanding: [] });
    assert.ok(html.includes("must not commence until the Notice of Commencement of Work has been issued"));
  });

  test("a checklist with nothing on it yet still points at the right place", () => {
    const { html } = certificateIssuedEmail({ pathway: "CDC", address: "21 Coquet Way", outstanding: [] });
    assert.ok(html.includes("PC — Notice of Commencement"));
    assert.ok(!html.includes("<ul"), "no empty list");
  });

  test("a Construction Certificate is named as one", () => {
    const { subject, html } = certificateIssuedEmail({ pathway: "CC", address: "9 Smith Street", outstanding: [] });
    assert.equal(subject, "CC issued — 9 Smith Street");
    assert.ok(html.includes("Construction Certificate"));
  });

  // A document title is typed by a certifier and can contain anything.
  test("a document title cannot smuggle html into the email", () => {
    const { html } = certificateIssuedEmail({ pathway: "CDC", address: "21 Coquet Way", outstanding: ['<script>alert("x")</script>'] });
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  });

  test("a project with no address recorded still sends", () => {
    const { subject, html } = certificateIssuedEmail({ pathway: "CDC", address: null, outstanding: [] });
    assert.equal(subject, "CDC issued");
    assert.ok(html.includes("has been issued"));
  });
});
