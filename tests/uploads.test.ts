import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { uploadProblem, MAX_UPLOAD_BYTES } from "@/lib/uploads";

const ok = (name: string, size = 1000) => uploadProblem({ name, size });

describe("what a client may send their certifier", () => {
  test("the things a certifier is actually sent all go through", () => {
    for (const name of [
      "structural-certificate.pdf",
      "Survey Report.PDF",
      "IMG_2043.HEIC",
      "slab.jpg",
      "elevations.dwg",
      "specification.docx",
      "schedule.xlsx",
    ]) {
      assert.equal(ok(name), null, `${name} should have been accepted`);
    }
  });

  // The disguise that is actually used: a name ending .pdf.exe reads as
  // a PDF in a list, and the extension that counts is the last one.
  test("a program wearing a document's name is refused", () => {
    for (const name of ["invoice.pdf.exe", "photo.jpg.js", "setup.bat", "run.scr", "macro.docm", "drawings.zip"]) {
      assert.ok(ok(name), `${name} should have been refused`);
    }
  });

  test("a file with no type on its name is refused rather than guessed at", () => {
    assert.match(ok("scan") || "", /no file type/i);
  });

  test("an oversized file says how big it is and what to do", () => {
    const problem = ok("plans.pdf", MAX_UPLOAD_BYTES + 1) || "";
    assert.match(problem, /51 MB/);
    assert.match(problem, /50 MB/);
  });

  test("an empty file is caught, since it usually means a half-finished save", () => {
    assert.match(ok("plans.pdf", 0) || "", /empty/i);
  });

  // The message is read by a builder on a phone who wants to get on with
  // it, not by a developer.
  test("the refusal says what to send instead", () => {
    assert.match(ok("drawings.zip") || "", /PDF or Word|JPG or PNG|PDF or DWG/);
  });
});
