import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { archiveSegment, jobFolder, documentFolder, versionFileName, inspectionFolder, photoFileName } from "@/lib/archive/archivePaths";

describe("laying out a job archive", () => {
  // Certificate references carry slashes and addresses carry commas.
  // Windows refuses several characters outright, and a folder it refuses
  // is a folder that silently doesn't extract.
  test("a job folder is named for the certificate and the address", () => {
    assert.equal(jobFolder("CDC-26001/01", "21 Coquet Way, Green Valley"), "CDC-26001-01 - 21 Coquet Way, Green Valley");
  });

  test("characters Windows rejects are removed", () => {
    assert.equal(archiveSegment('Plans: "rev A" <draft>'), "Plans rev A draft");
    assert.equal(archiveSegment("Report."), "Report", "a trailing dot makes a folder Windows will not create");
    assert.equal(archiveSegment("Report   "), "Report");
  });

  test("an empty name still produces a folder rather than nothing", () => {
    assert.equal(archiveSegment(""), "Untitled");
    assert.equal(jobFolder("", ""), "Job");
  });

  // Numbered so a file browser lists them in the order the job ran and
  // Schedule 1 lists them, not alphabetically.
  test("documents keep the certifier's order", () => {
    assert.equal(documentFolder(1, "CDC Application Form"), "02 Documents/01 CDC Application Form");
    assert.equal(documentFolder(12, "Architectural Plans"), "02 Documents/12 Architectural Plans");
  });

  test("versions sit together, with the one relied on marked", () => {
    assert.equal(versionFileName(1, false, "a/b/plans.pdf"), "v1.pdf");
    assert.equal(versionFileName(3, true, "a/b/plans.pdf"), "v3 (current).pdf");
    assert.equal(versionFileName(1, true, "a/b/noextension"), "v1 (current)");
  });

  test("an inspection folder carries the date it was carried out", () => {
    assert.equal(inspectionFolder(2, "Slab Steel", "20 Aug 2026"), "03 Inspections/02 Slab Steel - 20 Aug 2026");
    assert.equal(inspectionFolder(1, "Frame", null), "03 Inspections/01 Frame");
  });

  test("photos cannot collide, even when a phone names two the same", () => {
    assert.equal(photoFileName(1, "x/IMG_0001.jpg", "Slab reinforcement"), "01 Slab reinforcement.jpg");
    assert.equal(photoFileName(2, "x/IMG_0001.jpg", ""), "02.jpg");
    assert.notEqual(photoFileName(1, "x/IMG_0001.jpg", ""), photoFileName(2, "x/IMG_0001.jpg", ""));
  });
});
