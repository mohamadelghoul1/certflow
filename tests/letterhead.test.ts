import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { letterheadFor, isContractCertifier } from "@/lib/letterhead";
import type { Certifier, Firm } from "@/types/db";

const firm = {
  id: "f1",
  name: "Quality Private Certifiers",
  abn: "41 630 945 416",
  postal_address: "PO BOX 195, Blaxcell NSW 2142",
  office_address: "Suite 2/F1 101 Rookwood Road, Yagoona NSW 2199",
  phone: "0404 940 898",
  email: "info@qpcertifiers.com.au",
  website: "www.qpcertifiers.com.au",
  logo_url: "firm/logo.png",
} as Firm;

const employee = { id: "c1", name: "Mohamad El Ghoul", registration_no: "BDC2961" } as Certifier;
const contractor = {
  id: "c2",
  name: "Sam Rivers",
  registration_no: "BDC1122",
  practice_name: "Rivers Building Certification",
  practice_abn: "12 345 678 901",
  practice_postal_address: "PO BOX 44, Parramatta NSW 2150",
  practice_office_address: "9 Church Street, Parramatta NSW 2150",
  practice_phone: "0400 111 222",
  practice_email: "sam@riverscert.com.au",
  practice_website: "www.riverscert.com.au",
  practice_logo_url: "rivers/logo.png",
} as Certifier;

describe("whose letterhead an inspection report carries", () => {
  test("an employee's report carries the firm's", () => {
    const { letterhead, logoUrl } = letterheadFor(employee, firm);
    assert.equal(letterhead?.name, "Quality Private Certifiers");
    assert.equal(letterhead?.abn, "41 630 945 416");
    assert.equal(logoUrl, "firm/logo.png");
  });

  test("a contract certifier's report carries their own, with none of the firm's details on it", () => {
    const { letterhead, logoUrl } = letterheadFor(contractor, firm);
    assert.equal(letterhead?.name, "Rivers Building Certification");
    assert.equal(letterhead?.abn, "12 345 678 901");
    assert.equal(letterhead?.phone, "0400 111 222");
    assert.equal(logoUrl, "rivers/logo.png");

    // The point of the feature: nothing of the head firm appears.
    const printed = JSON.stringify(letterhead);
    for (const detail of [firm.name, firm.abn, firm.phone, firm.email, firm.postal_address, firm.office_address, firm.website]) {
      assert.ok(!printed.includes(detail!), `the firm's ${detail} must not appear on a contractor's letterhead`);
    }
  });

  // The company name is the test, not any of the other fields: a
  // letterhead carrying an ABN with no company above it is worse than
  // simply using the firm's.
  test("a half-filled practice still uses the firm's letterhead", () => {
    const half = { ...employee, practice_abn: "99 999 999 999" } as Certifier;
    assert.equal(isContractCertifier(half), false);
    assert.equal(letterheadFor(half, firm).letterhead?.name, "Quality Private Certifiers");
  });

  test("whitespace is not a company name", () => {
    assert.equal(isContractCertifier({ ...employee, practice_name: "   " } as Certifier), false);
  });

  // Every certifier that exists before migration 0025 has no practice
  // columns at all, and must be unaffected.
  test("a certifier with no practice columns at all is an employee", () => {
    assert.equal(isContractCertifier(employee), false);
    assert.equal(letterheadFor(employee, firm).letterhead?.name, firm.name);
  });

  test("an unassigned inspection falls back to the firm", () => {
    assert.equal(letterheadFor(null, firm).letterhead?.name, firm.name);
  });
});
