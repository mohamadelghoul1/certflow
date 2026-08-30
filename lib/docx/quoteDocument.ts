import { Document, Paragraph, Packer, AlignmentType } from "docx";
import type { FileChild } from "docx";
import type { ImageAsset } from "@/lib/docx/shared";
import { p, run, bullet, splitRow, gridTable, ruleLine, image, PAGE_PROPERTIES, FONT, TEXT_COLOR, SMALL_SIZE, TITLE_SIZE, MUTED_COLOR, LETTER_BODY_SIZE, LETTER_PARA_AFTER, LETTER_LINE_SPACING, SECTION_GAP } from "@/lib/docx/shared";
import type { QuoteDocumentData } from "@/lib/quotes/quoteData";
import { today } from "@/lib/business";

// The fee proposal as native Word — mirrors app/quotes/[id]/document/
// page.tsx section-for-section, both fed by lib/quotes/quoteData.ts, the
// same way the certificate package pairs with pathwayData. This replaced
// the HTML-cloning export, which Word rendered unstyled: Word knows
// nothing of the app's CSS classes, so only real OOXML paragraphs and
// tables survive the trip.

// The sand-coloured fee table header the on-screen quote uses.
const FEE_HEADER_FILL = "B8B49A";

// "Property Address:" underlined, the value alongside — the page's
// <u>label</u> pattern.
function labelled(label: string, value: string) {
  return new Paragraph({
    children: [run(`${label}: `, { bold: true, underline: true, size: LETTER_BODY_SIZE }), run(value, { size: LETTER_BODY_SIZE })],
    spacing: { after: LETTER_PARA_AFTER * 2, line: LETTER_LINE_SPACING },
  });
}

export async function buildQuoteDocx(data: QuoteDocumentData, images: { logo: ImageAsset | null }): Promise<Buffer> {
  const { quote, feeLines, firm, subtotal, gst, total, pathwayFull, validityLine, activeTerms, quoteNumber } = data;

  const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  // Letterhead: logo above the firm name on the left, contact block on
  // the right, ruled underneath — the layout the on-screen quote has.
  const left: Paragraph[] = [
    ...(images.logo ? [new Paragraph({ children: [image(images.logo.buffer, images.logo.type, images.logo.width, images.logo.height)], spacing: { after: 120 } })] : []),
    p(firm?.name || "", { bold: true, size: TITLE_SIZE, spacingAfter: 0 }),
  ];
  const right: Paragraph[] = [
    p(`${firm?.name || ""}`, { bold: true, size: SMALL_SIZE, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    ...(firm?.office_address ? [p(firm.office_address, { size: SMALL_SIZE, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 })] : []),
    p(`Phone: ${firm?.phone || "—"}`, { size: SMALL_SIZE, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(firm?.email || "", { size: SMALL_SIZE, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    ...(firm?.website ? [p(firm.website, { size: SMALL_SIZE, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 })] : []),
  ];

  const children: FileChild[] = [
    splitRow(left, right),
    ruleLine(),

    splitRow(`Quote Number: ${quoteNumber}`, `Date: ${today()}`, { size: LETTER_BODY_SIZE }),

    p("FEE PROPOSAL", { bold: true, size: LETTER_BODY_SIZE, align: AlignmentType.CENTER, spacingBefore: SECTION_GAP, spacingAfter: 0 }),
    p("FOR", { bold: true, size: LETTER_BODY_SIZE, align: AlignmentType.CENTER, spacingAfter: 0 }),
    p(`${pathwayFull} and Principal Certifier Services`, { bold: true, size: LETTER_BODY_SIZE, align: AlignmentType.CENTER, spacingAfter: SECTION_GAP }),

    labelled("Property Address", quote.proposal_address || "—"),
    labelled("Job Description", quote.development_description || "—"),

    p("Scope of Works", { bold: true, underline: true, size: LETTER_BODY_SIZE, spacingBefore: LETTER_PARA_AFTER * 2, spacingAfter: LETTER_PARA_AFTER }),
    ...(quote.scope_of_works || []).map((item) => bullet(item, { size: LETTER_BODY_SIZE })),

    p("", { spacingAfter: LETTER_PARA_AFTER }),
    gridTable(
      ["Description", "Fee"],
      feeLines.map((l) => [l.description || "—", l.amount ? Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"]),
      [82, 18],
      { headerFill: FEE_HEADER_FILL, size: LETTER_BODY_SIZE }
    ),

    p(`Subtotal: ${money(subtotal)}`, { size: LETTER_BODY_SIZE, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingBefore: LETTER_PARA_AFTER * 2, spacingAfter: 0 }),
    p(`GST: ${money(gst)}`, { size: LETTER_BODY_SIZE, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(`Total: ${money(total)}`, { bold: true, size: LETTER_BODY_SIZE, align: AlignmentType.RIGHT, spacingAfter: LETTER_PARA_AFTER * 2 }),

    p(`***Our fee is ${validityLine}.`, { bold: true, underline: true, size: LETTER_BODY_SIZE, spacingAfter: SECTION_GAP }),

    ...activeTerms.split("\n\n").map((para) => p(para, { size: LETTER_BODY_SIZE, justify: true, spacingAfter: LETTER_PARA_AFTER * 2, lineSpacing: LETTER_LINE_SPACING })),

    p("Kind Regards", { size: LETTER_BODY_SIZE, spacingBefore: SECTION_GAP, spacingAfter: 0 }),
    p(`${firm?.name || ""}`, { size: LETTER_BODY_SIZE, spacingAfter: 0 }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: LETTER_BODY_SIZE, color: TEXT_COLOR } } } },
    sections: [{ properties: PAGE_PROPERTIES, children }],
  });

  return Packer.toBuffer(doc);
}
