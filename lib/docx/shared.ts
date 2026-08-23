// Shared building blocks for generating real .docx certificate/letter
// documents with the `docx` library — the replacement for the old
// "clone the live DOM, inline every computed style, hope Word's legacy
// HTML importer copes" export path. A real .docx has native page breaks,
// table borders, and image sizing, so none of that class of Word-HTML-
// import quirk applies here: no mso-* properties, no CSSOM
// normalization traps, no default "Table Grid" style fighting a plain
// border:none.
import { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, VerticalAlignTable, ImageRun, ShadingType, HeightRule, convertMillimetersToTwip } from "docx";
import type { IBorderOptions, ITableCellBorders, TableVerticalAlign } from "docx";

// The document style, in one place. Sizes are docx half-points (22 = 11pt)
// and spacing is twips (20 per point, 240 per line).
export const FONT = "Segoe UI";
export const FONT_LIGHT = "Segoe UI Light";

export const BODY_SIZE = 22; // 11pt
export const HEADING_SIZE = 26; // 13pt
export const TITLE_SIZE = 28; // 14pt
export const SMALL_SIZE = 18; // 9pt — header, footer and captions
export const SIGNATURE_NAME_SIZE = 23; // 11.5pt — the signatory's name

export const TEXT_COLOR = "1C1C1E";
export const HEADING_COLOR = "1F4E79";
export const MUTED_COLOR = "555555";
export const LINE_COLOR = "D9D9D9";

export const LINE_SPACING = 276; // 1.15 lines
export const SPACE_BEFORE = 120; // 6pt
export const SPACE_AFTER = 120; // 6pt
export const HEADING_BEFORE = 240; // 12pt
export const SECTION_GAP = 300; // 15pt between major sections
// Letters set their body paragraphs a little further apart than ordinary
// prose. One value, so the council letter and the applicant letter always
// look like the same letter.
export const LETTER_PARA_AFTER = 80; // 4pt
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

// Top 2.2cm, bottom 2.0cm, sides 2.0cm.
export const PAGE_PROPERTIES = {
  page: {
    size: { width: convertMillimetersToTwip(A4_WIDTH_MM), height: convertMillimetersToTwip(A4_HEIGHT_MM) },
    margin: {
      top: convertMillimetersToTwip(22),
      bottom: convertMillimetersToTwip(20),
      left: convertMillimetersToTwip(20),
      right: convertMillimetersToTwip(20),
      header: convertMillimetersToTwip(5),
      footer: convertMillimetersToTwip(10),
    },
  },
};

// 0.15cm of padding inside every table cell.
const CELL_PADDING = convertMillimetersToTwip(1.5);
const ROW_HEIGHT = convertMillimetersToTwip(7); // 0.7cm

export function run(text: string, opts: { bold?: boolean; italic?: boolean; size?: number; color?: string; uppercase?: boolean; light?: boolean } = {}) {
  return new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italic,
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
export function addressBlock(lines: string[]) {
  return lines.map((line, i) => p(line, { spacingAfter: i === lines.length - 1 ? SPACE_AFTER : 0, lineSpacing: TIGHT_LINE_SPACING }));
}

// A paragraph built from mixed runs, e.g. "Re: <bold>123 Main St</bold>".
export function mixed(parts: { text: string; bold?: boolean; color?: string }[], opts: { spacingBefore?: number; spacingAfter?: number; lineSpacing?: number } = {}) {
  return new Paragraph({
    children: parts.map((part) => run(part.text, { bold: part.bold, color: part.color })),
    spacing: { before: opts.spacingBefore ?? 0, after: opts.spacingAfter ?? SPACE_AFTER, line: opts.lineSpacing ?? LINE_SPACING },
  });
}

export function bullet(text: string) {
  return new Paragraph({
    children: [run(`•  ${text}`)],
    indent: { left: convertMillimetersToTwip(5), hanging: convertMillimetersToTwip(5) },
    spacing: { after: 10, line: LINE_SPACING },
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
export function signatory(name: string | null | undefined, ...lines: string[]) {
  // keepNext holds the name and the lines under it together: they are one
  // block, and a letter that breaks between a signatory's name and their
  // registration number reads as an error. No trailing space — whatever
  // follows brings its own, and at the end of a letter there is nothing to
  // space away from.
  return [
    p(name || "—", { bold: true, size: SIGNATURE_NAME_SIZE, spacingAfter: 0, keepNext: true }),
    ...lines.map((line, i) => p(line, { color: MUTED_COLOR, spacingAfter: 0, lineSpacing: TIGHT_LINE_SPACING, keepNext: i < lines.length - 1 })),
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
    width: opts.widthPct !== undefined ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    borders: opts.borders ?? NO_CELL_BORDERS,
    verticalAlign: opts.verticalAlign ?? VerticalAlignTable.TOP,
    shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading } : undefined,
    columnSpan: opts.columnSpan,
    // Bordered tables get padding on all four sides; the borderless
    // label/value tables keep a flush left edge so labels line up with
    // the body text above them.
    margins: opts.padded
      ? { top: CELL_PADDING, bottom: CELL_PADDING, left: CELL_PADDING, right: CELL_PADDING }
      : { top: CELL_PADDING, bottom: CELL_PADDING, left: 0, right: CELL_PADDING },
  });
}

function borderlessTable(rows: TableRow[]) {
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
  });
}

// A left/right split row — reference+date lines, the footer's project
// number + website, and the letterhead's logo + contact block.
export function splitRow(left: string | Paragraph[], right: string | Paragraph[], opts: { leftPct?: number; bold?: boolean; size?: number; color?: string } = {}) {
  const leftChildren = typeof left === "string" ? [p(left, { bold: opts.bold, size: opts.size, color: opts.color, spacingAfter: 0 })] : left;
  const rightChildren = typeof right === "string" ? [p(right, { bold: opts.bold, size: opts.size, color: opts.color, align: AlignmentType.RIGHT, spacingAfter: 0 })] : right;
  return borderlessTable([
    new TableRow({
      children: [cell(leftChildren, { widthPct: opts.leftPct ?? 50 }), cell(rightChildren, { widthPct: 100 - (opts.leftPct ?? 50) })],
    }),
  ]);
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
  return borderlessTable(rows);
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
          cell([p(row.label, { bold: true, spacingAfter: 0, keepNext, align: AlignmentType.RIGHT })], { widthPct: 33 }),
          cell(valueChildren, { widthPct: 67 }),
        ],
      });
    })
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
  opts: { headerFill?: string; zebra?: boolean; centerColumns?: number[]; rowHeight?: number } = {}
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
          cell([p(h, { bold: true, spacingAfter: 0, align: align(i) })], {
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
              cell([p(v, { spacingAfter: 0, align: align(i) })], {
                widthPct: widths[i],
                borders: GRID_BODY_BORDERS,
                shading: opts.zebra && rowIndex % 2 === 1 ? ZEBRA_FILL : undefined,
                padded: true,
              })
            ),
          })
      ),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
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
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "FFFBEB" },
            borders: { top: CALLOUT_BORDER, bottom: CALLOUT_BORDER, left: CALLOUT_BORDER, right: CALLOUT_BORDER },
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
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
