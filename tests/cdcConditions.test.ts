import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { conditionParagraphs } from "@/lib/certificates/certificateValues";
import { certificateFixture } from "./helpers/fixture";

// The standard conditions a CDC is issued subject to: named on the
// certificate, and attached behind it. CDC only — a CC is issued against
// a consent whose conditions are the council's, and an Occupation
// Certificate imposes none of its own.

function withConditions(pathway: string, sets: { setId: string; name: string }[] | null) {
  const base = certificateFixture();
  return {
    ...base,
    job: { ...base.job, pathway },
    d: { ...base.d, cdcConditions: sets },
  } as ReturnType<typeof certificateFixture>;
}

describe("naming the conditions on the certificate", () => {
  test("each chosen set is named, under a line saying they are attached", () => {
    const paragraphs = conditionParagraphs(
      withConditions("CDC", [
        { setId: "a", name: "Greenfield Housing Code — conditions" },
        { setId: "b", name: "Demolition — conditions" },
      ])
    );
    const text = paragraphs.map((p) => p.text);
    assert.ok(text.some((t) => t.includes("issued subject to the following conditions, attached")));
    assert.ok(text.includes("Greenfield Housing Code — conditions"));
    assert.ok(text.includes("Demolition — conditions"), "a second set is named too, not just the first");
    // Named sets read as a list; the standing paragraphs are prose.
    assert.equal(paragraphs.find((p) => p.text === "Demolition — conditions")?.bulleted, true);
  });

  test("a job with none chosen prints what it always did", () => {
    const before = conditionParagraphs(withConditions("CDC", null)).map((p) => p.text);
    assert.ok(!before.some((t) => t.includes("attached to this approval")));
    assert.ok(before[0].includes("Environmental Planning and Assessment Regulation 2021"));
  });

  // The row is the CDC's. A CC job carrying the field — set before the
  // pathway was changed, say — must not start printing it.
  test("a CC job names nothing, even if the field carries something", () => {
    const text = conditionParagraphs(withConditions("CC", [{ setId: "a", name: "Greenfield Housing Code — conditions" }])).map((p) => p.text);
    assert.ok(!text.some((t) => t.includes("Greenfield")));
  });

  test("wording the certifier typed themselves still wins over all of it", () => {
    const base = withConditions("CDC", [{ setId: "a", name: "Greenfield Housing Code — conditions" }]);
    const paragraphs = conditionParagraphs({ ...base, docOverrides: { "cert.conditions": "Our own conditions." } } as typeof base);
    assert.deepEqual(paragraphs, [{ text: "Our own conditions.", bulleted: false }]);
  });
});

describe("attaching the conditions to the approved set", () => {
  async function onePager(text: string) {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage([595.28, 841.89]).drawText(text, { x: 60, y: 700, size: 14, font });
    return doc.save();
  }

  const stampDetails = { firmName: "", certRef: "", pathway: "", certifierName: "", registrationNo: "", date: "" };

  test("they follow the certificate and come before the approved documents", async () => {
    const { buildApprovalBundle } = await import("@/lib/pdf/bundle");
    const { readPdf } = await import("./helpers/readDocuments");

    const bytes = await buildApprovalBundle({
      heading: "CDC-26001/01 — approved set",
      subheading: "21 Coquet Way",
      approval: { bytes: await onePager("The certificate itself"), contentType: "application/pdf" },
      approvalLabel: "Approval",
      attachments: [{ label: "Conditions — Greenfield Housing Code", bytes: await onePager("Greenfield conditions") }],
      documents: [{ title: "Structural certificate", bytes: await onePager("Structural certificate"), contentType: "application/pdf" }],
      stampDetails,
    } as Parameters<typeof buildApprovalBundle>[0]);

    const { pages } = await readPdf(bytes);
    const at = (needle: string) => pages.findIndex((p) => p.replace(/\s+/g, " ").includes(needle));
    assert.ok(at("The certificate itself") < at("Greenfield conditions"), "the conditions follow the certificate");
    assert.ok(at("Greenfield conditions") < at("Structural certificate"), "and come before what the approval relied on");
  });

  // A set ticked but never uploaded cannot be appended. The set is built
  // anyway rather than failing, and the warning lives on the picker and
  // in Settings, where it can be fixed — the approved set has ended with
  // the last approved document since the closing page was dropped.
  test("a set with no PDF leaves the rest of the set whole", async () => {
    const { buildApprovalBundle } = await import("@/lib/pdf/bundle");
    const { readPdf } = await import("./helpers/readDocuments");

    const bytes = await buildApprovalBundle({
      heading: "CDC-26001/01 — approved set",
      subheading: "21 Coquet Way",
      approval: { bytes: await onePager("The certificate itself"), contentType: "application/pdf" },
      approvalLabel: "Approval",
      attachments: [{ label: "Conditions — Demolition", bytes: null }],
      documents: [],
      stampDetails,
    } as Parameters<typeof buildApprovalBundle>[0]);

    const { text, pageCount } = await readPdf(bytes);
    const flat = text.replace(/\s+/g, " ");
    assert.ok(flat.includes("The certificate itself"), "the approval is still there");
    assert.ok(!flat.includes("Not included"), "and no note about it reaches a document going to a council");
    assert.ok(pageCount >= 1);
  });
});
