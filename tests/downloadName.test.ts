import { test } from "node:test";
import assert from "node:assert/strict";
import { safeFileName, jobDocumentName, attachmentHeader, fileNameFromDisposition, asciiFileName } from "@/lib/downloadName";

// A certificate reference carries a slash, which every browser rewrites
// before saving — the defect that produced "CDC-26001_01-Approved-Set".
test("a reference's slash never reaches the browser", () => {
  assert.equal(safeFileName("CDC-26001/01"), "CDC-26001-01");
  assert.ok(!jobDocumentName("CDC-26001/01", "21 Coquet Way", "Approved Set", "pdf").includes("/"));
});

test("a document is filed under reference, address and what it is", () => {
  assert.equal(
    jobDocumentName("CDC-26001/01", "21 Coquet Way, Green Valley", "Approved Set", "pdf"),
    "CDC-26001-01 - 21 Coquet Way, Green Valley - Approved Set.pdf"
  );
});

// A certifier who renamed the reference to include the address should not
// be handed it twice.
test("an address already in the reference is not repeated", () => {
  assert.equal(
    jobDocumentName("CDC-26001 - 21 Coquet Way, Green Valley", "21 Coquet Way, Green Valley", "Approved Set", "pdf"),
    "CDC-26001 - 21 Coquet Way, Green Valley - Approved Set.pdf"
  );
});

test("the address match ignores case and punctuation", () => {
  const name = jobDocumentName("CDC-26001 - 21 COQUET WAY GREEN VALLEY", "21 Coquet Way, Green Valley", "Approved Set", "pdf");
  assert.equal(name, "CDC-26001 - 21 COQUET WAY GREEN VALLEY - Approved Set.pdf");
});

test("characters a filesystem rejects are dropped, spaces and commas kept", () => {
  assert.equal(safeFileName('CDC-26001/01 <draft>: "v2"'), "CDC-26001-01 draft v2");
});

// Sent twice so a client that reads only the ASCII form still gets a
// sensible name, and one that reads filename* gets the real characters.
test("the attachment header carries an ASCII name and a UTF-8 name", () => {
  const header = attachmentHeader("CDC-26001 – 21 Coquet Way.pdf");
  assert.match(header, /^attachment; filename="[^"]+"; filename\*=UTF-8''/);
  assert.ok(!/[^\x00-\x7f]/.test(header.split(";")[1]), "the plain filename must be ASCII only");
  assert.ok(header.includes(encodeURIComponent("–")), "filename* keeps the real character");
});

// The approved set is fetched in the background so the button can show
// progress, which means the browser no longer names the file for us — the
// page reads the name back out of the header itself. Whatever
// attachmentHeader writes, this has to be able to read.
test("the filename survives a round trip through the header", () => {
  const original = jobDocumentName("CDC-26001/01", "21 Coquet Way, Green Valley", "Approved Set", "pdf");
  assert.equal(fileNameFromDisposition(attachmentHeader(original)), original);
});

test("a name with characters the ASCII form can't carry comes back intact", () => {
  const original = "CDC-26001 – 21 Coquet Way, Green Valley - Approved Set.pdf";
  const recovered = fileNameFromDisposition(attachmentHeader(original));
  assert.equal(recovered, original, "filename* is preferred, so the en dash survives");
});

test("an unreadable header falls back rather than losing the download", () => {
  assert.equal(fileNameFromDisposition(null), "");
  assert.equal(fileNameFromDisposition("attachment"), "");
  // A broken percent-escape in filename* still leaves the ASCII name.
  assert.equal(fileNameFromDisposition(`attachment; filename="Approved Set.pdf"; filename*=UTF-8''%E0%A4%A`), "Approved Set.pdf");
});

// Chromium rejects an <a download> filename containing any non-ASCII
// character outright and saves the file as "download" — no name, no
// extension. Verified in Chromium rather than assumed, which is why the
// fetched download flattens the name before using it.
test("an accented name keeps its letters when flattened to ASCII", () => {
  assert.equal(asciiFileName("3 Rue Céline, Yagoona - Approved Set.pdf"), "3 Rue Celine, Yagoona - Approved Set.pdf");
});

test("a character with no ASCII letter underneath becomes a hyphen", () => {
  assert.equal(asciiFileName("CDC-26001 – 21 Coquet Way.pdf"), "CDC-26001 - 21 Coquet Way.pdf");
});

test("flattening never costs the extension", () => {
  for (const name of ["Zoë — plans.pdf", "CDC-26001/01 – set.pdf", "plain.pdf"]) {
    const flat = asciiFileName(name);
    assert.ok(flat.endsWith(".pdf"), `${name} kept its extension`);
    assert.ok(!/[^\x20-\x7e]/.test(flat), `${name} came out ASCII-only`);
  }
});
