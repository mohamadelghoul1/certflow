import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { archiveSegment, jobFolder, jobFolderRef, certificateFolder, documentFolder, versionFileName, inspectionFolder, photoFileName } from "@/lib/archive/archivePaths";

describe("laying out a job archive", () => {
  // Certificate references carry slashes and addresses carry commas.
  // Windows refuses several characters outright, and a folder it refuses
  // is a folder that silently doesn't extract.
  test("a job folder is named for the certificate and the address", () => {
    assert.equal(jobFolder("CDC-26001/01", "21 Coquet Way, Green Valley"), "CDC-26001 - 21 Coquet Way, Green Valley");
  });

  // One folder per job, not one per version — the way a certifier's own
  // filing already reads, so ours drops into the same list.
  test("the version a certificate belongs to is not part of the folder name", () => {
    assert.equal(jobFolderRef("CDC-26280/01"), "CDC-26280");
    assert.equal(jobFolderRef("CDC-26280/02"), "CDC-26280", "a re-issued certificate belongs in the same folder");
    assert.equal(jobFolder("CC-26315/03", "45 Sharples Circuit, Oran Park"), "CC-26315 - 45 Sharples Circuit, Oran Park");
  });

  test("a reference with no version is left exactly as the certifier typed it", () => {
    assert.equal(jobFolderRef("CDC-26280"), "CDC-26280");
    assert.equal(jobFolderRef("2026/14 Smith"), "2026/14 Smith", "only a trailing version comes off");
    assert.equal(jobFolderRef("CDC-26280/"), "CDC-26280/", "a stray slash is not a version");
    assert.equal(jobFolderRef(""), "");
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
    assert.equal(documentFolder(1, "CDC Application Form"), "Documents/Document Sets/01 CDC Application Form");
    assert.equal(documentFolder(12, "Architectural Plans"), "Documents/Document Sets/12 Architectural Plans");
  });

  test("versions sit together, with the one relied on marked", () => {
    assert.equal(versionFileName(1, false, "a/b/plans.pdf"), "v1.pdf");
    assert.equal(versionFileName(3, true, "a/b/plans.pdf"), "v3 (current).pdf");
    assert.equal(versionFileName(1, true, "a/b/noextension"), "v1 (current)");
  });

  test("an inspection folder carries the date it was carried out", () => {
    assert.equal(inspectionFolder(2, "Slab Steel", "20 Aug 2026"), "Documents/Inspections/02 Slab Steel - 20 Aug 2026");
    assert.equal(inspectionFolder(1, "Frame", null), "Documents/Inspections/01 Frame");
  });

  test("photos cannot collide, even when a phone names two the same", () => {
    assert.equal(photoFileName(1, "x/IMG_0001.jpg", "Slab reinforcement"), "01 Slab reinforcement.jpg");
    assert.equal(photoFileName(2, "x/IMG_0001.jpg", ""), "02.jpg");
    assert.notEqual(photoFileName(1, "x/IMG_0001.jpg", ""), photoFileName(2, "x/IMG_0001.jpg", ""));
  });
});

// The certificate goes under its own name, because "Complying Development
// Certificate" on a job where another certifier issued the approval files
// their document under our heading.
describe("which folder the certificate goes in", () => {
  test("each pathway names its own", () => {
    assert.equal(certificateFolder("CDC"), "Documents/Complying Development Certificate");
    assert.equal(certificateFolder("CC"), "Documents/Construction Certificate");
    assert.equal(certificateFolder("PC_OC"), "Documents/Approval", "a PC/OC job issues no certificate of ours");
  });
});
