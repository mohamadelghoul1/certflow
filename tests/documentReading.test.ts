import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { firstPages, contentBlockFor, normaliseDate, parseReading, readDocument, readingPrompt } from "@/lib/ai/documentReading";
import type { MessageCreator } from "@/lib/ai/outstandingSummary";

// The AI reads a document's title block so nobody has to type it. What
// is held here: only the first pages go, only PDFs and photos go at all,
// and whatever comes back is a suggestion in the app's own shape — a
// date is a date, an address check is one of three answers.

async function pdfWithPages(count: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) doc.addPage([200, 200]);
  return doc.save();
}

describe("what is sent", () => {
  test("a long PDF is cut to its first pages; a short one goes whole", async () => {
    const long = await firstPages(await pdfWithPages(9));
    assert.equal(long.pages, 4);
    assert.equal(long.total, 9);
    assert.equal((await PDFDocument.load(long.bytes)).getPageCount(), 4);

    const short = await pdfWithPages(2);
    const kept = await firstPages(short);
    assert.equal(kept.total, 2);
    assert.equal(kept.bytes, short, "an already-short PDF is passed through untouched");
  });

  test("a PDF goes as a document, a photo as an image, anything else is refused", async () => {
    const pdf = contentBlockFor({ bytes: await pdfWithPages(1), contentType: "application/pdf", fileName: "plan.pdf" });
    assert.equal(pdf.type, "document");
    const photo = contentBlockFor({ bytes: new Uint8Array([1, 2, 3]), contentType: null, fileName: "IMG_1234.JPG" });
    assert.equal(photo.type, "image");
    assert.equal((photo as { source: { media_type: string } }).source.media_type, "image/jpeg");
    assert.throws(() => contentBlockFor({ bytes: new Uint8Array([1]), contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName: "letter.docx" }), /Only PDFs and photos/);
  });

  test("the prompt says which project this is for and how much of the document was sent", () => {
    const text = readingPrompt(
      { file: { bytes: new Uint8Array(), contentType: null, fileName: "a.pdf" }, jobAddress: "12 Example St", lotSectionDp: "Lot 1 DP 2", itemTitle: "Site plan" },
      4,
      12
    );
    assert.ok(text.includes("Project address: 12 Example St"));
    assert.ok(text.includes("Lot / plan: Lot 1 DP 2"));
    assert.ok(text.includes("first 4 of 12 pages"));
  });
});

describe("what comes back", () => {
  test("dates are read day-first and written year-first", () => {
    assert.equal(normaliseDate("2025-03-14"), "2025-03-14");
    assert.equal(normaliseDate("14/03/2025"), "2025-03-14");
    assert.equal(normaliseDate("3/4/25"), "2025-04-03");
    assert.equal(normaliseDate("14 March 2025"), "2025-03-14");
    assert.equal(normaliseDate("14th Sept 2025"), "2025-09-14");
    assert.equal(normaliseDate("32/13/2025"), null);
    assert.equal(normaliseDate("last week"), null);
  });

  test("the answer is tidied into the app's shape", () => {
    const reading = parseReading(
      JSON.stringify({
        label: " Ground floor plan ",
        documentType: "Architectural drawing",
        preparedBy: "Studio Example",
        referenceNumber: "A-102",
        revision: "C",
        documentDate: "14/03/2025",
        addressOnDocument: "12 Example Street, Liverpool",
        addressMatches: "maybe",
        notes: ["Only the first 4 of 12 pages were read.", "  ", 7],
      })
    );
    assert.equal(reading.label, "Ground floor plan");
    assert.equal(reading.documentDate, "2025-03-14");
    assert.equal(reading.addressMatches, "unknown", "an answer outside yes/no is unknown, never a match");
    assert.deepEqual(reading.notes, ["Only the first 4 of 12 pages were read."]);
    assert.equal(parseReading('{"addressMatches":"no","notes":[]}').preparedBy, null);
  });

  test("the call sends the document and the project, and reads the text block back", async () => {
    let sent: Record<string, unknown> | null = null;
    const fake: MessageCreator = {
      messages: {
        async create(p) {
          sent = p as unknown as Record<string, unknown>;
          return {
            content: [{ type: "text", text: '{"label":"BASIX certificate 123","documentType":"BASIX","preparedBy":"X","referenceNumber":"123","revision":null,"documentDate":"2025-03-14","addressOnDocument":"12 Example St","addressMatches":"yes","notes":[]}' }],
          } as unknown as Awaited<ReturnType<MessageCreator["messages"]["create"]>>;
        },
      },
    };
    const result = await readDocument(
      { file: { bytes: await pdfWithPages(6), contentType: "application/pdf", fileName: "basix.pdf" }, jobAddress: "12 Example St", itemTitle: "BASIX certificate" },
      fake
    );
    assert.equal(result.reading.referenceNumber, "123");
    assert.equal(result.pagesRead, 4);
    assert.equal(result.totalPages, 6);
    const message = (sent as unknown as { messages: { content: { type: string }[] }[] }).messages[0];
    assert.deepEqual(
      message.content.map((c) => c.type),
      ["document", "text"]
    );
  });
});
