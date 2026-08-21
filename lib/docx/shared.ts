// Shared building blocks for generating real .docx certificate/letter
// documents with the `docx` library — the replacement for the old
// "clone the live DOM, inline every computed style, hope Word's legacy
// HTML importer copes" export path. A real .docx has native page breaks,
// table borders, and image sizing, so none of that class of Word-HTML-
// import quirk applies here: no mso-* properties, no CSSOM
// normalization traps, no default "Table Grid" style fighting a plain
// border:none.
import { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, VerticalAlignTable, ImageRun, ShadingType, convertMillimetersToTwip } from "docx";
import type { IBorderOptions, ITableCellBorders, TableVerticalAlign } from "docx";

export const FONT = "Calibri";
export const TEXT_COLOR = "1F2937";
export const MUTED_COLOR = "6B7280";
export const LINE_COLOR = "CBD5E1";

const NO_BORDER: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
export const NO_CELL_BORDERS: ITableCellBorders = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

const THIN_LINE: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR };
export const BOTTOM_LINE_ONLY: ITableCellBorders = { top: NO_BORDER, left: NO_BORDER, right: NO_BORDER, bottom: THIN_LINE };

const GRID_LINE: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" };
export const GRID_CELL_BORDERS: ITableCellBorders = { top: GRID_LINE, bottom: GRID_LINE, left: GRID_LINE, right: GRID_LINE };

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 15;

export const PAGE_PROPERTIES = {
  page: {
    size: { width: convertMillimetersToTwip(A4_WIDTH_MM), height: convertMillimetersToTwip(A4_HEIGHT_MM) },
    margin: {
      top: convertMillimetersToTwip(MARGIN_MM),
      bottom: convertMillimetersToTwip(MARGIN_MM),
      left: convertMillimetersToTwip(MARGIN_MM),
      right: convertMillimetersToTwip(MARGIN_MM),
      header: convertMillimetersToTwip(10),
      footer: convertMillimetersToTwip(10),
    },
  },
};

export function run(text: string, opts: { bold?: boolean; italic?: boolean; size?: number; color?: string; uppercase?: boolean } = {}) {
  return new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italic,
    size: opts.size ?? 20,
    color: opts.color ?? TEXT_COLOR,
    font: FONT,
    allCaps: opts.uppercase,
  });
}

// A plain text paragraph — the workhorse for every letter body line.
export function p(text: string, opts: { bold?: boolean; italic?: boolean; size?: number; color?: string; spacingBefore?: number; spacingAfter?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; justify?: boolean; uppercase?: boolean } = {}) {
  return new Paragraph({
    children: text ? [run(text, opts)] : [],
    spacing: { before: opts.spacingBefore ?? 0, after: opts.spacingAfter ?? 120 },
    alignment: opts.justify ? AlignmentType.JUSTIFIED : opts.align,
  });
}

// A paragraph built from mixed runs, e.g. "Re: <bold>123 Main St</bold>".
export function mixed(parts: { text: string; bold?: boolean; color?: string }[], opts: { spacingBefore?: number; spacingAfter?: number } = {}) {
  return new Paragraph({
    children: parts.map((part) => run(part.text, { bold: part.bold, color: part.color })),
    spacing: { before: opts.spacingBefore ?? 0, after: opts.spacingAfter ?? 120 },
  });
}

export function bullet(text: string) {
  return new Paragraph({
    children: [run(`•  ${text}`)],
    indent: { left: convertMillimetersToTwip(5), hanging: convertMillimetersToTwip(5) },
    spacing: { after: 60 },
  });
}

export function numbered(n: number, text: string) {
  return new Paragraph({
    children: [run(`${n}.  ${text}`)],
    indent: { left: convertMillimetersToTwip(6), hanging: convertMillimetersToTwip(6) },
    spacing: { after: 60 },
  });
}

// A bold section heading with a rule underneath spanning the full text
// width — a paragraph border, unlike signatureUnderline()'s short table
// cell, since a full-width rule is exactly what a paragraph border draws.
export function headingRule(text: string) {
  return new Paragraph({
    children: [run(text, { bold: true })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR, space: 2 } },
    spacing: { after: 120 },
  });
}

// Forces the next block onto a fresh page — real Word page-break-before,
// not an HTML-import hint Word is free to reinterpret.
export function pageBreak() {
  return new Paragraph({ children: [], pageBreakBefore: true });
}

function cell(children: readonly (Paragraph | Table)[], opts: { widthPct?: number; borders?: ITableCellBorders; verticalAlign?: TableVerticalAlign; shading?: string; columnSpan?: number } = {}) {
  return new TableCell({
    children,
    width: opts.widthPct !== undefined ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    borders: opts.borders ?? NO_CELL_BORDERS,
    verticalAlign: opts.verticalAlign ?? VerticalAlignTable.TOP,
    shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading } : undefined,
    columnSpan: opts.columnSpan,
    margins: { top: 40, bottom: 40, left: 0, right: 80 },
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
export function fieldTable(rows: FieldRow[]) {
  return borderlessTable(
    rows.map((row) => {
      if (row.kind === "heading") {
        return new TableRow({
          children: [cell([p(row.text, { bold: true, spacingAfter: 40 })], { widthPct: 100, columnSpan: 2, borders: BOTTOM_LINE_ONLY })],
        });
      }
      const valueChildren = row.children ?? [p(row.value || "—", { spacingAfter: 0 })];
      return new TableRow({
        children: [cell([p(row.label, { bold: true, spacingAfter: 0 })], { widthPct: 33 }), cell(valueChildren, { widthPct: 67 })],
      });
    })
  );
}

// A bordered grid table — the mandatory-inspections schedule and the
// document checklist, the two places this document genuinely wants
// visible gridlines (unlike everything else, which is deliberately plain).
export function gridTable(headers: string[], rows: string[][], columnWidths?: number[]) {
  const widths = columnWidths ?? headers.map(() => Math.round(100 / headers.length));
  return new Table({
    rows: [
      new TableRow({
        children: headers.map((h, i) => cell([p(h, { bold: true, spacingAfter: 0 })], { widthPct: widths[i], borders: GRID_CELL_BORDERS, shading: "F1F5F9" })),
        tableHeader: true,
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((v, i) => cell([p(v, { spacingAfter: 0 })], { widthPct: widths[i], borders: GRID_CELL_BORDERS })),
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
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// A short ruled line for a signature to sit on/above — a narrow bordered
// table rather than a paragraph border, since a paragraph's bottom border
// spans the whole line box (the full page width) regardless of content,
// not a short "sign here" line.
export function signatureUnderline(widthPct = 28) {
  return new Table({
    rows: [new TableRow({ children: [cell([p("", { spacingAfter: 0 })], { widthPct: 100, borders: BOTTOM_LINE_ONLY })] })],
    width: { size: widthPct, type: WidthType.PERCENTAGE },
  });
}
