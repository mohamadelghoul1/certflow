import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TEMPLATES, resolveTemplate, templateProblems, type CertificateTemplate } from "@/lib/certificates/certificateTemplate";
import { FIELD_KEYS, FIELD_NAMES, isRequired } from "@/lib/certificates/templateFields";

// The certificate a firm gets when it has never opened the editor must be
// the certificate it has always had. These pin the default row for row,
// so a change to it is a deliberate change to a statutory document rather
// than something that happened while refactoring.

const CDC_ROWS = [
  ["APPLICANT DETAILS", "Applicant:", "applicant"],
  ["APPLICANT DETAILS", "Address:", "applicantAddress"],
  ["APPLICANT DETAILS", "Phone:", "applicantPhone"],
  ["OWNER DETAILS", "Owner", "owner"],
  ["OWNER DETAILS", "Address:", "ownerAddress"],
  ["OWNER DETAILS", "Phone:", "ownerPhone"],
  ["COMPLYING DEVELOPMENT CERTIFICATE DETAILS", "NSW Planning Portal Ref Number:", "planningPortalRef"],
  ["COMPLYING DEVELOPMENT CERTIFICATE DETAILS", "Local Government Area:", "lga"],
  ["COMPLYING DEVELOPMENT CERTIFICATE DETAILS", "Relevant Environmental Planning Instrument", "epi"],
  ["COMPLYING DEVELOPMENT CERTIFICATE DETAILS", "Relevant Part of Code", "partOfCode"],
  ["COMPLYING DEVELOPMENT CERTIFICATE DETAILS", "Date of Determination:", "determinationDate"],
  ["COMPLYING DEVELOPMENT CERTIFICATE DETAILS", "Date of Lapse:", "lapseDate"],
  ["PROPOSAL", "Address of Development:", "devAddress"],
  ["PROPOSAL", "Lot/Section/DP:", "lotDp"],
  ["PROPOSAL", "Land Use Zone:", "zone"],
  ["PROPOSAL", "BCA Classification/s:", "bcaClass"],
  ["PROPOSAL", "BCA/NCC Version:", "bcaVersion"],
  ["PROPOSAL", "Description of Building Works:", "description"],
  ["PROPOSAL", "Value of Construction (incl. GST):", "value"],
  ["PROPOSAL", "Attachments", "attachments"],
  ["PROPOSAL", "Conditions:", "conditions"],
  ["PROPOSAL", "Critical stage inspections:", "inspections"],
  ["REGISTERED CERTIFIER", "Registered Certifier:", "certifierName"],
  ["REGISTERED CERTIFIER", "Registration Body:", "registrationBody"],
  ["REGISTERED CERTIFIER", "Registration No:", "registrationNo"],
];

const CC_ROWS = [
  ["APPLICANT DETAILS", "Applicant:", "applicant"],
  ["APPLICANT DETAILS", "Address:", "applicantAddress"],
  ["APPLICANT DETAILS", "Phone:", "applicantPhone"],
  ["OWNER DETAILS", "Owner:", "owner"],
  ["OWNER DETAILS", "Address:", "ownerAddress"],
  ["OWNER DETAILS", "Phone:", "ownerPhone"],
  ["RELEVANT DEVELOPMENT CONSENTS", "Consent Authority / Local Government Area:", "lga"],
  ["RELEVANT DEVELOPMENT CONSENTS", "Development Consent Number:", "developmentConsentNumber"],
  ["RELEVANT DEVELOPMENT CONSENTS", "Development Consent Date:", "developmentConsentDate"],
  ["RELEVANT DEVELOPMENT CONSENTS", "NSW Planning Portal Ref Number:", "planningPortalRef"],
  ["RELEVANT DEVELOPMENT CONSENTS", "Construction Certificate Number:", "certificateNumber"],
  ["RELEVANT DEVELOPMENT CONSENTS", "Date of Issue of Construction Certificate:", "issuedDate"],
  ["PROPOSAL", "Address of Development:", "devAddress"],
  ["PROPOSAL", "Lot/ DP:", "lotDp"],
  ["PROPOSAL", "BCA Classification:", "bcaClass"],
  ["PROPOSAL", "BCA/NCC Version:", "bcaVersion"],
  ["PROPOSAL", "Description of Building Works:", "description"],
  ["PROPOSAL", "Value of Construction Certificate (incl. GST)", "value"],
  ["PROPOSAL", "Attachments:", "attachments"],
  ["PROPOSAL", "Critical Stage Inspections:", "inspections"],
  ["REGISTERED CERTIFIER", "Registered Certifier:", "certifierName"],
  ["REGISTERED CERTIFIER", "Registration Body:", "registrationBody"],
  ["REGISTERED CERTIFIER", "Registration No:", "registrationNo"],
];

function flatten(sections: { heading: string; rows: { label: string; key: string }[] }[]) {
  return sections.flatMap((s) => s.rows.map((r) => [s.heading, r.label, r.key]));
}

describe("the certificate every firm starts from", () => {
  test("a CDC prints exactly the rows it always has", () => {
    const resolved = resolveTemplate(DEFAULT_TEMPLATES.CDC, {}, "Complying Development Certificate");
    assert.deepEqual(flatten(resolved), CDC_ROWS);
  });

  test("a CC prints exactly the rows it always has", () => {
    const resolved = resolveTemplate(DEFAULT_TEMPLATES.CC, {}, "Construction Certificate");
    assert.deepEqual(flatten(resolved), CC_ROWS);
  });

  // The two pathways label the same value differently, and that
  // difference is on the certificates the firm has already issued.
  test("the two pathways keep their own labels", () => {
    const cdc = resolveTemplate(DEFAULT_TEMPLATES.CDC, {}, "x").flatMap((s) => s.rows);
    const cc = resolveTemplate(DEFAULT_TEMPLATES.CC, {}, "x").flatMap((s) => s.rows);
    assert.equal(cdc.find((r) => r.key === "lotDp")!.label, "Lot/Section/DP:");
    assert.equal(cc.find((r) => r.key === "lotDp")!.label, "Lot/ DP:");
    assert.equal(cdc.find((r) => r.key === "owner")!.label, "Owner");
    assert.equal(cc.find((r) => r.key === "owner")!.label, "Owner:");
  });

  test("the heading takes the pathway's own name", () => {
    const resolved = resolveTemplate(DEFAULT_TEMPLATES.CDC, {}, "Complying Development Certificate");
    assert.ok(resolved.some((s) => s.heading === "COMPLYING DEVELOPMENT CERTIFICATE DETAILS"));
    assert.ok(!resolved.some((s) => s.heading.includes("{PATHWAY}")), "the placeholder must not reach the page");
  });

  test("conditions print as paragraphs, not as one value beside a label", () => {
    const rows = resolveTemplate(DEFAULT_TEMPLATES.CDC, {}, "x").flatMap((s) => s.rows);
    assert.equal(rows.find((r) => r.key === "conditions")!.kind, "conditions");
    assert.equal(rows.find((r) => r.key === "devAddress")!.kind, "field");
  });

  test("every row is filled from the job", () => {
    const values = { devAddress: "28 Eucalyptus Street", description: "New dwelling" };
    const rows = resolveTemplate(DEFAULT_TEMPLATES.CDC, values, "x").flatMap((s) => s.rows);
    assert.equal(rows.find((r) => r.key === "devAddress")!.value, "28 Eucalyptus Street");
    assert.equal(rows.find((r) => r.key === "description")!.value, "New dwelling");
    assert.equal(rows.find((r) => r.key === "zone")!.value, "", "a value the job has not got prints blank, not undefined");
  });

  test("a firm's own wording prints instead of a job value", () => {
    const template: CertificateTemplate = {
      pathway: "CDC",
      sections: [{ heading: "OUR SECTION", rows: [{ source: "fixed", label: "Issued under:", fixedValue: "Part 4, Division 4.5" }] }],
    };
    const rows = resolveTemplate(template, { devAddress: "ignored" }, "x").flatMap((s) => s.rows);
    assert.deepEqual(rows, [{ key: "fixed", label: "Issued under:", value: "Part 4, Division 4.5", kind: "field" }]);
  });
});

describe("a template that cannot be used", () => {
  const good = DEFAULT_TEMPLATES.CDC;

  test("the default is always usable", () => {
    assert.deepEqual(templateProblems(DEFAULT_TEMPLATES.CDC), []);
    assert.deepEqual(templateProblems(DEFAULT_TEMPLATES.CC), []);
  });

  test("a row filled by something the certificate has not got is caught", () => {
    const broken: CertificateTemplate = {
      ...good,
      sections: good.sections.map((s) => (s.heading === "PROPOSAL" ? { ...s, rows: [...s.rows, { source: "moonPhase" as never, label: "Moon:" }] } : s)),
    };
    assert.ok(templateProblems(broken).some((p) => p.includes("moonPhase")));
  });

  // A certificate that could drop what the Regulation requires would let
  // a firm issue something that is not a certificate.
  test("a statutory row cannot be dropped", () => {
    const without: CertificateTemplate = {
      ...good,
      sections: good.sections.map((s) => ({ ...s, rows: s.rows.filter((r) => r.source !== "devAddress") })),
    };
    assert.ok(templateProblems(without).some((p) => p.includes("devAddress")));
  });

  test("an empty template and an unlabelled row are caught", () => {
    assert.ok(templateProblems({ pathway: "CDC", sections: [] }).some((p) => /at least one section/.test(p)));
    const blank: CertificateTemplate = { pathway: "CDC", sections: [{ heading: "APPLICANT", rows: [{ source: "applicant", label: " " }] }] };
    assert.ok(templateProblems(blank).some((p) => /no label/.test(p)));
  });

  // A section without a heading prints its rows and nothing else. An
  // Occupation Certificate opens with exactly such a block, under the
  // certificate's own title rather than a heading of its own.
  test("a section with no heading is allowed", () => {
    const headless: CertificateTemplate = {
      pathway: "OC",
      sections: [
        {
          heading: "",
          rows: [
            { source: "devAddress", label: "Property address:" },
            { source: "lotDp", label: "Lot/Section/DP:" },
            { source: "description", label: "Development description:" },
            { source: "consentRelied", label: "Approval relied upon:" },
            { source: "issuedDate", label: "Date of issue:" },
          ],
        },
      ],
    };
    assert.deepEqual(templateProblems(headless), []);
  });

  test("what is required differs by pathway", () => {
    assert.equal(isRequired("CDC", "determinationDate"), true);
    assert.equal(isRequired("CC", "determinationDate"), false);
    assert.equal(isRequired("CC", "developmentConsentNumber"), true);
    assert.equal(isRequired("CDC", "zone"), false);
  });
});

describe("the list a certifier picks rows from", () => {
  test("every value has a name to choose it by", () => {
    for (const key of FIELD_KEYS) {
      assert.ok(FIELD_NAMES[key] && FIELD_NAMES[key].trim().length > 0, `${key} has no name`);
    }
  });

  test("every row in both defaults is a value the catalogue knows", () => {
    for (const template of [DEFAULT_TEMPLATES.CDC, DEFAULT_TEMPLATES.CC]) {
      for (const section of template.sections) {
        for (const row of section.rows) {
          assert.ok(FIELD_KEYS.includes(row.source as never), `${row.label} is filled by unknown ${row.source}`);
        }
      }
    }
  });
});
