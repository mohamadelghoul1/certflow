import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import JSZip from "jszip";

// Reading generated documents back, so a test can assert on what a
// certifier would actually see rather than on the code that drew it.

export type PdfPages = { pageCount: number; pages: string[]; text: string };

// pdf.js's legacy build: the default one calls a Map method that isn't in
// shipping Safari, and this project already pins the legacy build for the
// stamp positioner for that reason.
export async function readPdf(bytes: Uint8Array): Promise<PdfPages> {
  const doc = await getDocument({ data: bytes, useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return { pageCount: doc.numPages, pages, text: pages.join("\n") };
}

// A .docx is a zip; word/document.xml holds the body text.
export async function readDocx(buffer: Buffer): Promise<{ xml: string; text: string }> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = (await zip.file("word/document.xml")?.async("string")) || "";
  const text = xml
    .replace(/<w:p[ >]/g, "\n<w:p ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8217;/g, "\u2019");
  return { xml, text };
}

// How many page breaks the Word document carries — a proxy for its page
// count that doesn't need a rendering engine. pageBreak() in
// lib/docx/shared.ts writes <w:pageBreakBefore/> on a paragraph rather
// than a <w:br w:type="page"/> run, so both spellings are counted.
export function docxPageBreaks(xml: string) {
  return (xml.match(/<w:pageBreakBefore\s*\/>/g) || []).length + (xml.match(/<w:br w:type="page"\s*\/>/g) || []).length;
}
