import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { AI_MODEL, type MessageCreator } from "@/lib/ai/outstandingSummary";

// Reading the Schedule 1 details off an uploaded document.
//
// Every document in an approved set is listed on Schedule 1 with who
// prepared it, its number, its revision and its date — and every one of
// those was typed by hand off the title block, dozens of times a week.
// This asks the model to read them off the document instead and hands
// them back as suggestions. Suggestions only: nothing is written until
// the certifier presses Use, because a revision letter misread is a
// schedule that names the wrong drawing.
//
// What leaves the building: the first few pages of the document itself,
// the project address (to check the document is for this site), and the
// name of the checklist item it was uploaded against. The document is
// the point — it cannot be read without being sent — so the button says
// so, and reads nothing until it is pressed.

export const MAX_PAGES_READ = 4;
export const MAX_BYTES_READ = 18 * 1024 * 1024;

export type DocumentReading = {
  // What kind of document this is, in the model's words — "BASIX
  // certificate", "structural engineering drawing". Shown, never saved.
  documentType: string | null;
  label: string | null;
  preparedBy: string | null;
  referenceNumber: string | null;
  revision: string | null;
  // Always year-month-day here, whatever the document printed.
  documentDate: string | null;
  addressOnDocument: string | null;
  addressMatches: "yes" | "no" | "unknown";
  notes: string[];
};

export type ReadableFile = { bytes: Uint8Array; contentType: string | null; fileName: string };

export type ReadingInput = {
  file: ReadableFile;
  jobAddress: string;
  lotSectionDp?: string | null;
  itemTitle: string;
};

// ------------------------------------------------------------ the file

// A drawing set can run to sixty pages, and everything Schedule 1 needs
// is on the first one or two. Only the first few go: the rest would be
// paid for and never looked at.
export async function firstPages(bytes: Uint8Array, maxPages = MAX_PAGES_READ): Promise<{ bytes: Uint8Array; pages: number; total: number }> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = source.getPageCount();
  if (total <= maxPages) return { bytes, pages: total, total };

  const trimmed = await PDFDocument.create();
  const copied = await trimmed.copyPages(source, Array.from({ length: maxPages }, (_, i) => i));
  for (const page of copied) trimmed.addPage(page);
  return { bytes: await trimmed.save(), pages: maxPages, total };
}

type ImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function imageTypeOf(contentType: string | null, fileName: string): ImageType | null {
  const declared = (contentType || "").toLowerCase().split(";")[0].trim();
  if (declared === "image/jpeg" || declared === "image/png" || declared === "image/gif" || declared === "image/webp") return declared;
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return null;
}

export function isPdf(contentType: string | null, fileName: string): boolean {
  return (contentType || "").toLowerCase().includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
}

// The document as the API takes it: a PDF as a document block, a photo
// as an image block. Anything else — a Word file, a spreadsheet — is
// refused with a reason rather than sent and misread.
export function contentBlockFor(file: ReadableFile): Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam {
  if (file.bytes.byteLength > MAX_BYTES_READ) throw new Error("That document is too large to read — over 18 MB.");
  const data = Buffer.from(file.bytes).toString("base64");
  if (isPdf(file.contentType, file.fileName)) {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  const image = imageTypeOf(file.contentType, file.fileName);
  if (image) return { type: "image", source: { type: "base64", media_type: image, data } };
  throw new Error("Only PDFs and photos can be read. Save the document as a PDF and upload it again.");
}

// ---------------------------------------------------------- the reading

const SYSTEM_PROMPT = `You read documents uploaded to a building certifier's file in New South Wales, Australia — drawings, engineer's certificates, BASIX certificates, reports, surveys, insurance certificates, forms — and pull out the details the certifier lists on Schedule 1 of a building approval.

Report only what is printed on the document. Never guess or fill in from general knowledge. Where something is not printed, return null.

- label: a short name for this document as it would appear on a schedule — "Ground floor plan", "BASIX certificate 1234567A", "Structural certificate". Not the file name.
- documentType: what kind of document it is, in a few words.
- preparedBy: the company or person who prepared, issued or signed it — the firm in the title block, the engineer's practice, the assessor.
- referenceNumber: the document's own number — drawing number, certificate number, report number, job number on the title block. Keep its exact formatting.
- revision: the revision or issue letter or number, if any. Just the letter or number.
- documentDate: the date the document was issued, prepared, signed or revised — the latest date on it. Australian dates are day/month/year. Return it as YYYY-MM-DD.
- addressOnDocument: the site or property address printed on the document, if any.
- addressMatches: "yes" if the address on the document is plainly the same property as the project address you are given (spelling and abbreviations may differ), "no" if it is plainly a different property, "unknown" if no address is printed or it cannot be told.
- notes: short warnings the certifier should see — the address or lot differs from the project, the document is unsigned where a signature is expected, it has expired, it refers to a different stage of work, it is a draft or marked preliminary, only part of it could be read. Empty when there is nothing to say.

You are given only the first few pages of a long document; say so in notes if the details may be on a later page.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    label: { type: ["string", "null"] },
    documentType: { type: ["string", "null"] },
    preparedBy: { type: ["string", "null"] },
    referenceNumber: { type: ["string", "null"] },
    revision: { type: ["string", "null"] },
    documentDate: { type: ["string", "null"] },
    addressOnDocument: { type: ["string", "null"] },
    addressMatches: { type: "string", enum: ["yes", "no", "unknown"] },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["label", "documentType", "preparedBy", "referenceNumber", "revision", "documentDate", "addressOnDocument", "addressMatches", "notes"],
  additionalProperties: false,
};

export function readingPrompt(input: ReadingInput, pagesRead: number, totalPages: number): string {
  const lines = [
    `Project address: ${input.jobAddress || "(not recorded)"}`,
    input.lotSectionDp ? `Lot / plan: ${input.lotSectionDp}` : null,
    `Uploaded against the checklist item: ${input.itemTitle}`,
    `File name: ${input.file.fileName}`,
    totalPages > pagesRead ? `This is the first ${pagesRead} of ${totalPages} pages.` : null,
  ];
  return lines.filter((l): l is string => !!l).join("\n");
}

export async function readDocument(
  input: ReadingInput,
  client: MessageCreator = new Anthropic()
): Promise<{ reading: DocumentReading; pagesRead: number; totalPages: number }> {
  let file = input.file;
  let pagesRead = 1;
  let totalPages = 1;
  if (isPdf(file.contentType, file.fileName)) {
    let trimmed: Awaited<ReturnType<typeof firstPages>>;
    try {
      trimmed = await firstPages(file.bytes);
    } catch {
      throw new Error("That PDF could not be opened. Try saving it again as a PDF and uploading it.");
    }
    file = { ...file, bytes: trimmed.bytes };
    pagesRead = trimmed.pages;
    totalPages = trimmed.total;
  }

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [contentBlockFor(file), { type: "text", text: readingPrompt(input, pagesRead, totalPages) }] }],
  });

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("The AI answered without any text.");
  return { reading: parseReading(text.text), pagesRead, totalPages };
}

// ----------------------------------------------------------- the answer

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || /^(null|n\/a|none|unknown|-)$/i.test(text)) return null;
  return text;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

// The model is asked for year-month-day and usually obliges; this is
// for the times it does not. Day-first, because the documents are
// Australian — an American reading of 3/4/2025 is the wrong date.
export function normaliseDate(value: string | null): string | null {
  if (!value) return null;
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return assemble(iso[1], iso[2], iso[3]);
  const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (dmy) return assemble(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3], dmy[2], dmy[1]);
  const words = text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (words) {
    const month = MONTHS[words[2].slice(0, 4).toLowerCase()] ?? MONTHS[words[2].slice(0, 3).toLowerCase()];
    if (month) return assemble(words[3], String(month), words[1]);
  }
  return null;
}

function assemble(year: string, month: string, day: string): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseReading(json: string): DocumentReading {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object") throw new Error("The AI answer was not in the expected shape.");
  const matches = parsed.addressMatches;
  return {
    documentType: clean(parsed.documentType),
    label: clean(parsed.label),
    preparedBy: clean(parsed.preparedBy),
    referenceNumber: clean(parsed.referenceNumber),
    revision: clean(parsed.revision),
    documentDate: normaliseDate(clean(parsed.documentDate)),
    addressOnDocument: clean(parsed.addressOnDocument),
    addressMatches: matches === "yes" || matches === "no" ? matches : "unknown",
    notes: Array.isArray(parsed.notes) ? parsed.notes.filter((n): n is string => typeof n === "string" && n.trim() !== "").map((n) => n.trim()) : [],
  };
}
