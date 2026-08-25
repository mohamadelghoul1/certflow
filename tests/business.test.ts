import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { photoSlotsRemaining, MAX_INSPECTION_PHOTOS } from "@/lib/constants";
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
  pathwayStageComplete,
  inspectionsCarriedOut,
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

// Four photos fill the report's photo page exactly. The arithmetic is
// worth pinning down: a negative slot count used as a slice length hands
// back the whole selection and ignores the cap entirely.
test("an inspection offers photo slots up to the limit and never below zero", () => {
  assert.equal(photoSlotsRemaining(0), MAX_INSPECTION_PHOTOS);
  assert.equal(photoSlotsRemaining(3), 1);
  assert.equal(photoSlotsRemaining(MAX_INSPECTION_PHOTOS), 0);
  assert.equal(photoSlotsRemaining(MAX_INSPECTION_PHOTOS + 2), 0);
});

test("the slot count is what limits a multi-photo selection", () => {
  const chosen = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"];
  assert.deepEqual(chosen.slice(0, photoSlotsRemaining(2)), ["a.jpg", "b.jpg"]);
  assert.deepEqual(chosen.slice(0, photoSlotsRemaining(MAX_INSPECTION_PHOTOS)), []);
});

describe("when a stage counts as finished", () => {
  test("a certificate is issued only once it is signed, not merely generated", () => {
    assert.equal(pathwayStageComplete({ pathway_generated: false }), false);
    assert.equal(pathwayStageComplete({ pathway_generated: true }), false, "generated but unsigned is 'to issue', not issued");
    assert.equal(pathwayStageComplete({ pathway_generated: true, pathway_signed_at: "2026-08-25T00:00:00Z" }), true);
  });

  test("a signed copy uploaded by the certifier counts as issued", () => {
    assert.equal(pathwayStageComplete({ pathway_generated: true, pathway_approval_uploaded: true }), true);
  });

  test("inspections are carried out once none are still pending, whatever was found", () => {
    assert.equal(inspectionsCarriedOut([]), false, "a job with no inspections has nothing to be finished");
    assert.equal(inspectionsCarriedOut(["passed", "pending"]), false);
    assert.equal(inspectionsCarriedOut(["passed", "failed"]), true, "a failed inspection was still carried out");
    assert.equal(inspectionsCarriedOut(["passed", "passed_subject_to"]), true);
  });
});
