// Shared building blocks for generating real .docx certificate/letter
// documents with the `docx` library — the replacement for the old
// "clone the live DOM, inline every computed style, hope Word's legacy
// HTML importer copes" export path. A real .docx has native page breaks,
// table borders, and image sizing, so none of that class of Word-HTML-
// import quirk applies here: no mso-* properties, no CSSOM
// normalization traps, no default "Table Grid" style fighting a plain
// border:none.
import { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, VerticalAlignTable, ImageRun, ShadingType, HeightRule, TableLayoutType, convertMillimetersToTwip } from "docx";
import type { IBorderOptions, ITableCellBorders, TableVerticalAlign } from "docx";

// The document style, in one place. Sizes are docx half-points (22 = 11pt)
// and spacing is twips (20 per point, 240 per line).
export const FONT = "Segoe UI";
export const FONT_LIGHT = "Segoe UI Light";

// The whole document sets at the same size the on-screen copy prints at,
// so the Word export, the PDF approved set and the browser's own
// "Save as PDF" all produce the same seven pages with the same breaks.
// A CDC certificate carries around twenty-six fields plus conditions; at
// 11pt its table runs to one and a half A4 pages however the spacing is
// tuned, which is what forced the three apart.
export const BODY_SIZE = 17; // 8.5pt
export const HEADING_SIZE = 20; // 10pt
export const TITLE_SIZE = 21; // 10.5pt
export const SMALL_SIZE = 14; // 7pt — header, footer and captions
export const SIGNATURE_NAME_SIZE = 18; // 9pt — the signatory's name
// The two covering letters set larger than the rest of the pack. They are
// prose on a mostly empty page, not a dense form, so the size that makes
// the certificate fit its table reads as too small in a letter — and both
// letters have a third of a page spare at the smaller size anyway.
export const LETTER_BODY_SIZE = 22; // 11pt
export const LETTER_SIGNATURE_NAME_SIZE = 23; // 11.5pt

export const TEXT_COLOR = "1C1C1E";
export const HEADING_COLOR = "1F4E79";
export const MUTED_COLOR = "555555";
export const LINE_COLOR = "D9D9D9";

// Single, matching the PDF approved set's leading exactly. At 1.15 the
// same paragraph stood 1.8pt taller per line than the PDF's, which over a
// certificate is most of a page.
export const LINE_SPACING = 240; // single
export const SPACE_BEFORE = 90; // 4.5pt
export const SPACE_AFTER = 90; // 4.5pt
export const HEADING_BEFORE = 150; // 7.5pt
export const SECTION_GAP = 220; // 11pt between major sections
// Letters set their body paragraphs a little further apart than ordinary
// prose. One value, so the council letter and the applicant letter always
// look like the same letter.
export const LETTER_PARA_AFTER = 60; // 3pt
// Letter bodies are set a touch tighter than the 1.15 used elsewhere, so a
// long letter still closes with its signature on the same page instead of
// pushing three lines onto a second sheet.
export const LETTER_LINE_SPACING = 240; // single
export const TIGHT_LINE_SPACING = 240; // single — the letterhead small print

// Table shading: the plain register grey, and the heavier blue reserved
// for the mandatory inspections schedule so it stands out.
export const TABLE_HEADER_FILL = "F2F2F2";
export const INSPECTION_HEADER_FILL = "D9E2F3";
export const ZEBRA_FILL = "FAFAFA";

const NO_BORDER: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
export const NO_CELL_BORDERS: ITableCellBorders = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

// docx border size is eighths of a point: 4 = 0.5pt, 2 = 0.25pt.
const THIN_LINE: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR };
export const BOTTOM_LINE_ONLY: ITableCellBorders = { top: NO_BORDER, left: NO_BORDER, right: NO_BORDER, bottom: THIN_LINE };

const GRID_LINE: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const GRID_LINE_LIGHT: IBorderOptions = { style: BorderStyle.SINGLE, size: 2, color: "D9D9D9" };
export const GRID_CELL_BORDERS: ITableCellBorders = { top: GRID_LINE, bottom: GRID_LINE, left: GRID_LINE, right: GRID_LINE };
const GRID_BODY_BORDERS: ITableCellBorders = { top: GRID_LINE_LIGHT, bottom: GRID_LINE_LIGHT, left: GRID_LINE_LIGHT, right: GRID_LINE_LIGHT };

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Every table is laid out FIXED at absolute twip widths rather than
// percentages. Desktop Word quietly recalculates percentage columns, but
// Word on Mac, iOS and the web honours the written grid literally — and
// the docx library writes a 100-twip (1.8mm) grid column for a
// percentage cell, which those Words render as a one-letter-wide strip.
const CONTENT_WIDTH = convertMillimetersToTwip(A4_WIDTH_MM - 28); // page minus the 14mm margins
const pctW = (pct: number) => Math.round((CONTENT_WIDTH * pct) / 100);

// 1.4cm all round, the same margin the on-screen document prints at, so
// the three surfaces wrap at the same width and break at the same places.
export const PAGE_PROPERTIES = {
  page: {
    size: { width: convertMillimetersToTwip(A4_WIDTH_MM), height: convertMillimetersToTwip(A4_HEIGHT_MM) },
    margin: {
      top: convertMillimetersToTwip(12),
      bottom: convertMillimetersToTwip(12),
      left: convertMillimetersToTwip(14),
      right: convertMillimetersToTwip(14),
      header: convertMillimetersToTwip(2),
      footer: convertMillimetersToTwip(7),
    },
  },
};

// 0.15cm of padding inside a bordered grid cell, where it sits between
// the text and a visible rule and has to be seen.
const CELL_PADDING = convertMillimetersToTwip(1.5);
// The borderless label/value rows are a different job: nothing is drawn
// around them, so the padding only adds pitch. At 1.5mm each row stood
// 22.3pt tall against the same row's 19.8pt in the PDF approved set,
// which is why the Word certificate ran to three pages where the PDF took
// two. 0.9mm brings the two to the same row height.
const FIELD_CELL_PADDING = convertMillimetersToTwip(0.1);
const ROW_HEIGHT = convertMillimetersToTwip(4); // 0.4cm

export function run(text: string, opts: { bold?: boolean; italic?: boolean; underline?: boolean; size?: number; color?: string; uppercase?: boolean; light?: boolean } = {}) {
  return new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italic,
    underline: opts.underline ? {} : undefined,
    size: opts.size ?? BODY_SIZE,
    color: opts.color ?? TEXT_COLOR,
    font: opts.light ? FONT_LIGHT : FONT,
    allCaps: opts.uppercase,
  });
}

// A plain text paragraph — the workhorse for every letter body line.
export function p(
  text: string,
  opts: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    size?: number;
    color?: string;
    spacingBefore?: number;
    spacingAfter?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    justify?: boolean;
    uppercase?: boolean;
    // Word's "keep with next" — stops a page break falling between this
    // paragraph and the one after it. Used to hold blocks that only make
    // sense read together (a certifier's registration body and number,
    // say) on the same page.
    keepNext?: boolean;
    light?: boolean;
    lineSpacing?: number;
  } = {}
) {
  return new Paragraph({
    children: text ? [run(text, opts)] : [],
    spacing: { before: opts.spacingBefore ?? 0, after: opts.spacingAfter ?? SPACE_AFTER, line: opts.lineSpacing ?? LINE_SPACING },
    alignment: opts.justify ? AlignmentType.JUSTIFIED : opts.align,
    keepNext: opts.keepNext,
  });
}

// The name and address at the top of a letter: one block, set tight, with
// a paragraph's worth of air only under the last line. Each line carrying
// its own paragraph spacing made the addressee look like four separate
// one-line paragraphs.
export function addressBlock(lines: string[], opts: { size?: number } = {}) {
  return lines.map((line, i) => p(line, { size: opts.size, spacingAfter: i === lines.length - 1 ? SPACE_AFTER : 0, lineSpacing: TIGHT_LINE_SPACING }));
}

// A paragraph built from mixed runs, e.g. "Re: <bold>123 Main St</bold>".
export function mixed(parts: { text: string; bold?: boolean; color?: string }[], opts: { spacingBefore?: number; spacingAfter?: number; lineSpacing?: number; size?: number } = {}) {
  return new Paragraph({
    children: parts.map((part) => run(part.text, { bold: part.bold, color: part.color, size: opts.size })),
    spacing: { before: opts.spacingBefore ?? 0, after: opts.spacingAfter ?? SPACE_AFTER, line: opts.lineSpacing ?? LINE_SPACING },
  });
}

export function bullet(text: string, opts: { size?: number } = {}) {
  return new Paragraph({
    children: [run(`•  ${text}`, { size: opts.size })],
    indent: { left: convertMillimetersToTwip(5), hanging: convertMillimetersToTwip(5) },
    spacing: { after: 0, line: LINE_SPACING },
  });
}

export function numbered(n: number, text: string) {
  return new Paragraph({
    children: [run(`${n}.  ${text}`)],
    indent: { left: convertMillimetersToTwip(6), hanging: convertMillimetersToTwip(6) },
    spacing: { after: 60, line: LINE_SPACING },
  });
}

// A bold section heading with a rule underneath spanning the full text
// width — a paragraph border, unlike signatureUnderline()'s short table
// cell, since a full-width rule is exactly what a paragraph border draws.
export function headingRule(text: string) {
  return new Paragraph({
    children: [run(text, { bold: true, size: HEADING_SIZE, color: HEADING_COLOR })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR, space: 3 } },
    spacing: { before: HEADING_BEFORE, after: SPACE_AFTER, line: LINE_SPACING },
    alignment: AlignmentType.LEFT,
  });
}

// A hairline across the full text width, under the letterhead.
export function ruleLine() {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR, space: 1 } },
    spacing: { before: 0, after: 0 },
  });
}

// The footer: project number and website on one centred line, ruled
// above. Separated by a middle dot rather than pushed to opposite margins,
// so it reads as a single line of small print.
export function footerLine(projectRef: string, website: string | null | undefined) {
  const site = (website || "").trim();
  return new Paragraph({
    children: [run(site ? `${projectRef}  ·  ${site}` : projectRef, { size: SMALL_SIZE, color: MUTED_COLOR })],
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR, space: 6 } },
    spacing: { before: 0, after: 0 },
  });
}

// The document's own title — the certificate name and number. Same blue
// as the section headings, a size up, ruled underneath. An optional
// subtitle (a project reference, or the Act the instrument is issued
// under) sits inside the same ruled block, so the rule always closes the
// title rather than cutting through it.
export function documentTitle(text: string, opts: { subtitle?: string | string[]; center?: boolean; uppercase?: boolean } = {}): Paragraph[] {
  const rule = { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR, space: 3 } };
  const alignment = opts.center ? AlignmentType.CENTER : AlignmentType.LEFT;
  const subtitles = (Array.isArray(opts.subtitle) ? opts.subtitle : opts.subtitle ? [opts.subtitle] : []).filter(Boolean);
  return [
    new Paragraph({
      children: [run(text, { bold: true, size: TITLE_SIZE, color: HEADING_COLOR, uppercase: opts.uppercase })],
      border: subtitles.length ? undefined : rule,
      spacing: { after: subtitles.length ? 40 : 160, line: LINE_SPACING },
      alignment,
      keepNext: true,
    }),
    ...subtitles.map((line, i) => {
      const last = i === subtitles.length - 1;
      return new Paragraph({
        children: [run(line, { size: SMALL_SIZE, color: MUTED_COLOR })],
        border: last ? rule : undefined,
        spacing: { after: last ? 160 : 40, line: LINE_SPACING },
        alignment,
        keepNext: true,
      });
    }),
  ];
}

// A hairline above a letter's closing block, separating the body of the
// letter from "Yours sincerely" and the signatory's details. Distinct
// from the old rule *under* the signature image, which read as an
// unfinished form field and was removed.
export function signatureRule() {
  return new Paragraph({
    children: [],
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR, space: 6 } },
    spacing: { before: 60, after: 0 },
  });
}

// The signatory's name, title and firm under a signature — the name a
// half-point up and semibold, the two lines under it at body size rather
// than the fine print they used to be set in.
export function signatory(name: string | null | undefined, ...lines: string[]): Paragraph[];
export function signatory(opts: { size?: number; nameSize?: number }, name: string | null | undefined, ...lines: string[]): Paragraph[];
export function signatory(a: unknown, ...rest: unknown[]): Paragraph[] {
  const opts = typeof a === "object" && a !== null ? (a as { size?: number; nameSize?: number }) : {};
  const [name, ...lines] = (typeof a === "object" && a !== null ? rest : [a, ...rest]) as (string | null | undefined)[];
  return signatoryBlock(opts, name, lines.filter((l): l is string => typeof l === "string"));
}

function signatoryBlock(opts: { size?: number; nameSize?: number }, name: string | null | undefined, lines: string[]) {
  // keepNext holds the name and the lines under it together: they are one
  // block, and a letter that breaks between a signatory's name and their
  // registration number reads as an error. No trailing space — whatever
  // follows brings its own, and at the end of a letter there is nothing to
  // space away from.
  return [
    p(name || "—", { bold: true, size: opts.nameSize ?? SIGNATURE_NAME_SIZE, spacingAfter: 0, keepNext: true }),
    ...lines.map((line, i) => p(line, { size: opts.size, color: MUTED_COLOR, spacingAfter: 0, lineSpacing: TIGHT_LINE_SPACING, keepNext: i < lines.length - 1 })),
  ];
}

// Forces the next block onto a fresh page — real Word page-break-before,
// not an HTML-import hint Word is free to reinterpret.
export function pageBreak() {
  return new Paragraph({ children: [], pageBreakBefore: true });
}

function cell(children: readonly (Paragraph | Table)[], opts: { widthPct?: number; borders?: ITableCellBorders; verticalAlign?: TableVerticalAlign; shading?: string; columnSpan?: number; padded?: boolean } = {}) {
  return new TableCell({
    children,
    width: opts.widthPct !== undefined ? { size: pctW(opts.widthPct), type: WidthType.DXA } : undefined,
    borders: opts.borders ?? NO_CELL_BORDERS,
    verticalAlign: opts.verticalAlign ?? VerticalAlignTable.TOP,
    shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading } : undefined,
    columnSpan: opts.columnSpan,
    // Bordered tables get padding on all four sides; the borderless
    // label/value tables keep a flush left edge so labels line up with
    // the body text above them.
    margins: opts.padded
      ? { top: CELL_PADDING, bottom: CELL_PADDING, left: CELL_PADDING, right: CELL_PADDING }
      : { top: FIELD_CELL_PADDING, bottom: FIELD_CELL_PADDING, left: 0, right: CELL_PADDING },
  });
}

function borderlessTable(rows: TableRow[], columnsPct: number[] = [50, 50]) {
  return new Table({
    rows,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    // The explicit grid is what Word on Mac, iOS and the web actually
    // lay the columns out from; without it the library writes 100-twip
    // placeholder columns that those Words render one letter wide.
    columnWidths: columnsPct.map(pctW),
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
  });
}

// A left/right split row — reference+date lines, the footer's project
// number + website, and the letterhead's logo + contact block.
export function splitRow(left: string | Paragraph[], right: string | Paragraph[], opts: { leftPct?: number; bold?: boolean; size?: number; color?: string } = {}) {
  const leftChildren = typeof left === "string" ? [p(left, { bold: opts.bold, size: opts.size, color: opts.color, spacingAfter: 0 })] : left;
  const rightChildren = typeof right === "string" ? [p(right, { bold: opts.bold, size: opts.size, color: opts.color, align: AlignmentType.RIGHT, spacingAfter: 0 })] : right;
  const leftPct = opts.leftPct ?? 50;
  return borderlessTable(
    [
      new TableRow({
        children: [cell(leftChildren, { widthPct: leftPct }), cell(rightChildren, { widthPct: 100 - leftPct })],
      }),
    ],
    [leftPct, 100 - leftPct]
  );
}

// A two-column grid of images + captions, one row per pair — the
// inspection-photo evidence page. An odd photo out just gets an empty
// second cell rather than stretching to fill the row.
export function photoGrid(items: { image: Paragraph; caption: Paragraph }[]) {
  const rows: TableRow[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    rows.push(
      new TableRow({
        children: [
          cell([left.image, left.caption], { widthPct: 50 }),
          cell(right ? [right.image, right.caption] : [p("", { spacingAfter: 0 })], { widthPct: 50 }),
        ],
      })
    );
  }
  return borderlessTable(rows, [50, 50]);
}

export type FieldRow = { kind: "heading"; text: string } | { kind: "row"; label: string; value?: string | null; children?: readonly Paragraph[] };

// The label/value tables used throughout every certificate and notice —
// APPLICANT DETAILS, PROPOSAL, REGISTERED CERTIFIER, etc. Section headings
// get a bottom rule; ordinary rows are borderless.
// `keepTogether` holds the whole table — and whatever paragraph follows
// it — on one page. Word paginates a table row by row, so without it a
// short block like the certifier's registration details can be split down
// the middle, leaving the registration number stranded on the next page.
export function fieldTable(rows: FieldRow[], opts: { keepTogether?: boolean } = {}) {
  const keepNext = opts.keepTogether || undefined;
  return borderlessTable(
    rows.map((row) => {
      if (row.kind === "heading") {
        return new TableRow({
          cantSplit: keepNext,
          children: [
            cell([p(row.text, { bold: true, size: HEADING_SIZE, color: HEADING_COLOR, spacingBefore: HEADING_BEFORE, spacingAfter: SPACE_AFTER, keepNext })], {
              widthPct: 100,
              columnSpan: 2,
              borders: BOTTOM_LINE_ONLY,
            }),
          ],
        });
      }
      const valueChildren = row.children ?? [p(row.value || "—", { spacingAfter: 0, keepNext })];
      return new TableRow({
        cantSplit: keepNext,
        height: { value: ROW_HEIGHT, rule: HeightRule.ATLEAST },
        children: [
          cell([p(row.label, { bold: true, spacingAfter: 0, keepNext, align: AlignmentType.RIGHT })], { widthPct: 28 }),
          cell(valueChildren, { widthPct: 72 }),
        ],
      });
    }),
    [28, 72]
  );
}

// A bordered grid table — the mandatory-inspections schedule and the
// document checklist, the two places this document genuinely wants
// visible gridlines (unlike everything else, which is deliberately plain).
// A bordered grid table.
//
// `headerFill` distinguishes the two registers this document uses: the
// mandatory inspections schedule takes the heavier blue so it stands out,
// the document checklist the plain grey. `zebra` shades alternate body
// rows for the long checklist; `centerColumns` centres the columns that
// hold a number or a status rather than prose. Body borders are lighter
// than the header's, so the header reads as the top of the table.
export function gridTable(
  headers: string[],
  rows: string[][],
  columnWidths?: number[],
  opts: { headerFill?: string; zebra?: boolean; centerColumns?: number[]; rowHeight?: number; size?: number } = {}
) {
  const widths = columnWidths ?? headers.map(() => Math.round(100 / headers.length));
  const centered = new Set(opts.centerColumns ?? []);
  const align = (i: number) => (centered.has(i) ? AlignmentType.CENTER : AlignmentType.LEFT);

  return new Table({
    rows: [
      new TableRow({
        tableHeader: true,
        height: { value: opts.rowHeight ?? ROW_HEIGHT, rule: HeightRule.ATLEAST },
        children: headers.map((h, i) =>
          cell([p(h, { bold: true, size: opts.size, spacingAfter: 0, align: align(i) })], {
            widthPct: widths[i],
            borders: GRID_CELL_BORDERS,
            shading: opts.headerFill ?? TABLE_HEADER_FILL,
            padded: true,
          })
        ),
      }),
      ...rows.map(
        (r, rowIndex) =>
          new TableRow({
            height: { value: opts.rowHeight ?? ROW_HEIGHT, rule: HeightRule.ATLEAST },
            children: r.map((v, i) =>
              cell([p(v, { size: opts.size, spacingAfter: 0, align: align(i) })], {
                widthPct: widths[i],
                borders: GRID_BODY_BORDERS,
                shading: opts.zebra && rowIndex % 2 === 1 ? ZEBRA_FILL : undefined,
                padded: true,
              })
            ),
          })
      ),
    ],
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: widths.map(pctW),
  });
}

export type ImageAsset = { buffer: Buffer; type: "png" | "jpg"; width: number; height: number };

export function image(data: Buffer, type: "png" | "jpg" | "gif" | "bmp", width: number, height: number) {
  return new ImageRun({ type, data, transformation: { width, height } });
}

const CALLOUT_BORDER: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: "FDE68A" };

// The amber "required documents" / "failure to request an inspection"
// callout boxes — a single shaded, bordered cell rather than paragraph
// shading, so the padding and border read as one enclosed box.
export function calloutBox(children: Paragraph[]) {
  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children,
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "FFFBEB" },
            borders: { top: CALLOUT_BORDER, bottom: CALLOUT_BORDER, left: CALLOUT_BORDER, right: CALLOUT_BORDER },
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
          }),
        ],
      }),
    ],
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [CONTENT_WIDTH],
  });
}

// The signature itself, or — while unsigned — just the blank vertical gap
// where it will go once signed. Previously followed by a short ruled
// line, which read as redundant once a real signature image was already
// sitting right above it (a printed "sign here" line under an actual
// signature stroke looks like an unfinished form field, not a finished
// document) — removed everywhere this is used: every certificate, letter,
// and inspection report.
export function signatureBlock(signature: ImageAsset | null) {
  if (signature) {
    return [new Paragraph({ children: [image(signature.buffer, signature.type, signature.width, signature.height)], spacing: { before: 40, after: 40 } })];
  }
  return [new Paragraph({ spacing: { before: 180, after: 60 } })];
}
