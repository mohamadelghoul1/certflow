import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { uploadProblem, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, UPLOAD_HINT } from "@/lib/uploads";

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
    assert.match(problem, new RegExp(`${MAX_UPLOAD_MB + 1} MB`));
    assert.match(problem, new RegExp(`${MAX_UPLOAD_MB} MB`));
  });

  test("a file at exactly the limit is accepted, not rounded away", () => {
    assert.equal(ok("plans.pdf", MAX_UPLOAD_BYTES), null);
  });

  // The note on the portal and the refusal have to agree, or a client is
  // told one thing and then another.
  test("the note a client reads names the same limit that is enforced", () => {
    assert.match(UPLOAD_HINT, new RegExp(`${MAX_UPLOAD_MB} MB`));
    // Big enough for a full architectural set without splitting it —
    // a client stopped by an upload limit rings the certifier, which is
    // the phone call Certlyn exists to avoid. Raised with
    // NEXT_PUBLIC_MAX_UPLOAD_MB in Vercel; the Supabase project's own
    // limit has to allow at least as much.
    assert.equal(MAX_UPLOAD_MB, 100);
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
