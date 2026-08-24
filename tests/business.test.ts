import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatClassifications,
  formatDocumentDate,
  formatISODate,
  pathwayCertRef,
  resolvePathwayCertRef,
  calcCdcLapseDate,
  portalRefKindFor,
  normalizePortalRef,
  governingApproval,
  stageComplete,
  checklistProgress,
  letterheadAddressLines,
  pathwayLabel,
  issuesCertificate,
} from "@/lib/business";

// A certificate names the classification, not the plain-English gloss the
// tick boxes carry.
test("classifications print as the class alone", () => {
  assert.equal(formatClassifications(["Class 1a — Single dwelling"]), "Class 1a");
  assert.equal(formatClassifications(["Class 1a — Single dwelling", "Class 10a — Non-habitable (garage, shed, carport)"]), "Class 1a, 10a");
});

test("a classification typed by hand is printed as written", () => {
  assert.equal(formatClassifications(["Class 1a — Single dwelling", "Something typed by hand"]), "Class 1a, Something typed by hand");
});

test("no classifications prints nothing rather than a stray label", () => {
  assert.equal(formatClassifications([]), "");
  assert.equal(formatClassifications(undefined), "");
  assert.equal(formatClassifications(null), "");
});

// "Not yet scheduled" belongs to an inspection with no date, never to a
// document on an approved-plans schedule.
test("a document with no date reads as a dash, not 'Not yet scheduled'", () => {
  assert.equal(formatDocumentDate(null), "—");
  assert.equal(formatDocumentDate(undefined), "—");
  assert.equal(formatDocumentDate(""), "—");
  assert.equal(formatISODate(null), "Not yet scheduled");
});

test("dates print as day, short month, year — from a date or a timestamp", () => {
  assert.equal(formatDocumentDate("2026-08-24"), "24 Aug 2026");
  assert.equal(formatDocumentDate("2026-08-24T04:19:03.123Z"), "24 Aug 2026");
});

test("a custom reference wins, blank falls back to the generated one", () => {
  assert.equal(resolvePathwayCertRef("CDC-26001 - 21 Coquet Way", "CDC", "CDC-26001", 1), "CDC-26001 - 21 Coquet Way");
  assert.equal(resolvePathwayCertRef("   ", "CDC", "CDC-26001", 1), pathwayCertRef("CDC", "CDC-26001", 1));
  assert.equal(resolvePathwayCertRef(null, "CDC", "CDC-26001", 1), "CDC-26001/01");
});

// A PC/OC job issues no certificate of its own; its documents name the
// previous certifier's approval.
test("a PC/OC job's documents name the prior approval", () => {
  const prior = { type: "CDC" as const, number: "CDC-99999/01", date: "2026-01-05", issuedBy: "Another Firm" };
  const ours = governingApproval("CDC", undefined, "CDC-26001/01");
  const theirs = governingApproval("PC_OC", prior, "PC-26001/01");
  assert.equal(ours.ref, "CDC-26001/01");
  assert.equal(theirs.ref, "CDC-99999/01");
  assert.equal(issuesCertificate("PC_OC"), false);
  assert.equal(pathwayLabel("PC_OC"), "PC/OC");
});

test("an OC application takes the CFT series, a CDC its own", () => {
  assert.equal(portalRefKindFor("CDC"), "CDC");
  assert.equal(portalRefKindFor("PC_OC"), "OC");
  assert.equal(normalizePortalRef("331766", "CDC"), "CDC-331766");
  assert.equal(normalizePortalRef("123456", "OC"), "CFT-123456");
  assert.equal(normalizePortalRef("CDC-331766", "CDC"), "CDC-331766", "a reference that already carries its prefix is left alone");
});

test("a CDC lapses five years from determination until work commences", () => {
  const noc = [{ status: "approved" as const }];
  const openNoc = [{ status: "requested" as const }];
  assert.equal(calcCdcLapseDate("CDC", "2026-08-24", openNoc, []), "2031-08-24");
  assert.equal(calcCdcLapseDate("CDC", "2026-08-24", noc, ["passed"]), "N/A — construction commenced");
  assert.equal(calcCdcLapseDate("CC", "2026-08-24", openNoc, []), "", "a CC has no lapse date");
});

test("a stage is complete only when it has items and all are approved", () => {
  assert.equal(stageComplete([]), false, "an empty checklist is not a finished one");
  assert.equal(stageComplete([{ status: "approved" }, { status: "submitted" }]), false);
  assert.equal(stageComplete([{ status: "approved" }, { status: "approved" }]), true);
  assert.equal(checklistProgress([{ status: "approved" }, { status: "requested" }]), "1/2");
});

test("the letterhead puts the suburb on its own line", () => {
  assert.deepEqual(letterheadAddressLines("Suite 2/F1 101 Rookwood Road, Yagoona NSW 2199"), ["Suite 2/F1 101 Rookwood Road,", "Yagoona NSW 2199"]);
  assert.deepEqual(letterheadAddressLines(""), ["—"]);
});
