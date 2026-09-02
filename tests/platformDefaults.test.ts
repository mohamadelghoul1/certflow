import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadCertificateTemplate } from "@/lib/certificates/loadTemplate";
import { loadFirmWording } from "@/lib/certificates/loadWording";
import { DEFAULT_TEMPLATES } from "@/lib/certificates/certificateTemplate";
import { fakeSupabase } from "./helpers/fakeSupabase";

// Three layers, and the order matters: what this firm saved, then what
// the platform owner published as the standard, then Certlyn's built-in.
// A firm that has customised its own is never overwritten from outside —
// customising is a decision, not something to be undone by someone else
// publishing a new standard.

const FIRM = "firm-1";

// One section, valid enough to pass templateProblems for an OC.
const ocSections = (label: string) => [
  {
    heading: "",
    rows: [
      { source: "devAddress", label },
      { source: "lotDp", label: "Lot:" },
      { source: "description", label: "Works:" },
      { source: "consentRelied", label: "Approval:" },
    ],
  },
];

function templateClient(rows: unknown[]) {
  return fakeSupabase((call) => (call.table === "certificate_templates" ? { data: rows } : { data: null })).client;
}

describe("which certificate layout a firm is drawn from", () => {
  test("its own wins over everything", async () => {
    const client = templateClient([
      { firm_id: null, layout: { sections: ocSections("Published:") } },
      { firm_id: FIRM, layout: { sections: ocSections("Mine:") } },
    ]);
    const { template, custom } = await loadCertificateTemplate(client, FIRM, "OC");
    assert.equal(template.sections[0].rows[0].label, "Mine:");
    assert.equal(custom, true);
  });

  test("the published standard is used when the firm has saved none", async () => {
    const client = templateClient([{ firm_id: null, layout: { sections: ocSections("Published:") } }]);
    const { template, custom } = await loadCertificateTemplate(client, FIRM, "OC");
    assert.equal(template.sections[0].rows[0].label, "Published:");
    assert.equal(custom, false, "a firm on the published standard has not customised anything");
  });

  test("the built-in is used when nobody has published one", async () => {
    const { template } = await loadCertificateTemplate(templateClient([]), FIRM, "OC");
    assert.deepEqual(template, DEFAULT_TEMPLATES.OC);
  });

  // A standard that cannot be drawn would otherwise take every firm's
  // certificate down at once — the one failure worth guarding hardest.
  test("a broken published standard falls through to the built-in", async () => {
    const client = templateClient([{ firm_id: null, layout: { sections: [{ heading: "", rows: [{ source: "devAddress", label: "Only:" }] }] } }]);
    const { template } = await loadCertificateTemplate(client, FIRM, "OC");
    assert.deepEqual(template, DEFAULT_TEMPLATES.OC);
  });

  test("a broken layout of the firm's own falls back to the published standard, and says so", async () => {
    const client = templateClient([
      { firm_id: null, layout: { sections: ocSections("Published:") } },
      { firm_id: FIRM, layout: { sections: [{ heading: "", rows: [{ source: "devAddress", label: "Broken:" }] }] } },
    ]);
    const { template, problems } = await loadCertificateTemplate(client, FIRM, "OC");
    assert.equal(template.sections[0].rows[0].label, "Published:");
    assert.ok(problems.length > 0, "the firm is told their own layout is unusable");
  });
});

describe("which wording a firm's letters are drawn from", () => {
  function wordingClient(rows: unknown[]) {
    return fakeSupabase((call) => (call.table === "firm_document_wording" ? { data: rows } : { data: null })).client;
  }

  test("the firm's own overrides the published standard, key by key", async () => {
    const wording = await loadFirmWording(
      wordingClient([
        { firm_id: null, doc_key: "council.body", body: "Published council" },
        { firm_id: null, doc_key: "applicant.body", body: "Published applicant" },
        { firm_id: FIRM, doc_key: "council.body", body: "My council" },
      ]),
      FIRM
    );
    assert.equal(wording["council.body"], "My council");
    assert.equal(wording["applicant.body"], "Published applicant", "an untouched letter still gets the published standard");
  });

  test("nothing published and nothing saved is nothing at all, so the documents print their built-in text", async () => {
    assert.deepEqual(await loadFirmWording(wordingClient([]), FIRM), {});
  });
});
