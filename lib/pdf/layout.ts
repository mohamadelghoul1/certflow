import { PDFDocument, StandardFonts, rgb, setWordSpacing, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

// A small layout engine over pdf-lib.
//
// pdf-lib draws text at coordinates and nothing more — no wrapping, no
// tables, no flowing onto a new page. The certificate package needs all
// three, so this adds them: a cursor that moves down the page, text that
// wraps (and justifies) to a width, label/value rows, bordered tables,
// and a page break when the cursor runs out of room.
//
// It exists because the approved set has to be a PDF. The .docx builder
// can't be reused for it — Word documents can't be merged into a PDF
// without converting them, which needs software this doesn't have.
//
// The measurements below deliberately mirror lib/docx/shared.ts, so the
// PDF in the approved set and the Word export read as the same document:
// same margins, same type sizes, same colours, same table rules. The one
// thing that can't match is the typeface — Segoe UI is licensed to
// Microsoft and can't be embedded here, so this uses Helvetica, the
// closest neutral sans among the fonts every PDF reader already has.

export const A4: [number, number] = [595.28, 841.89];

const MM = 2.834645669; // PostScript points per millimetre
// 1.4cm at the sides, 1.2cm top and bottom — the same proportions the
// Word export uses, so the two wrap and break identically.
export const MARGIN = 14 * MM;
export const MARGIN_TOP = 12 * MM;
export const MARGIN_BOTTOM = 12 * MM;
// The letterhead is taller than the top margin, so where it starts decides
// where the body starts. Matches the Word header offset.
export const HEADER_TOP = 7 * MM;

// Type sizes, matching the Word document's scale exactly.
export const BODY_SIZE = 8.5;
export const HEADING_SIZE = 10;
export const TITLE_SIZE = 10.5;
export const SMALL_SIZE = 7;
export const SIGNATURE_NAME_SIZE = 9;

// Word's "1.15 lines" works out at roughly 1.32x the point size once its
// own single-line leading is taken into account.
const LINE_FACTOR = 1.32;
// Letters set a little tighter than the rest, so a long one still closes
// with its signature on the same page. Matches the Word letter leading.
const LETTER_LINE_FACTOR = 1.15;
export const LETTER_PARA_AFTER = 5;
export const SPACE_AFTER = 4.5;
export const HEADING_BEFORE = 8;
export const SECTION_GAP = 11;

export const INK = rgb(0x1c / 255, 0x1c / 255, 0x1e / 255);
export const MUTED = rgb(0x55 / 255, 0x55 / 255, 0x55 / 255);
export const LINE = rgb(0xd9 / 255, 0xd9 / 255, 0xd9 / 255);
export const HEADING_COLOR = rgb(0x1f / 255, 0x4e / 255, 0x79 / 255);
export const HEADRULE = LINE;

export const TABLE_HEADER_FILL = rgb(0xf2 / 255, 0xf2 / 255, 0xf2 / 255);
export const INSPECTION_HEADER_FILL = rgb(0xd9 / 255, 0xe2 / 255, 0xf3 / 255);
export const ZEBRA_FILL = rgb(0xfa / 255, 0xfa / 255, 0xfa / 255);

// The amber "you must provide" / "failure to request an inspection" box,
// the same pair of colours the Word version uses.
const CALLOUT_FILL = rgb(0xff / 255, 0xfb / 255, 0xeb / 255);
const CALLOUT_BORDER = rgb(0xfd / 255, 0xe6 / 255, 0x8a / 255);

const GRID_LINE = rgb(0xbf / 255, 0xbf / 255, 0xbf / 255);
const CELL_PAD = 1.5 * MM; // 0.15cm
const ROW_HEIGHT = 4 * MM; // 0.4cm

export type TextOpts = {
  size?: number;
  bold?: boolean;
  color?: RGB;
  align?: "left" | "right" | "center";
  justify?: boolean;
  letter?: boolean;
  width?: number;
  x?: number;
  gapAfter?: number;
  lineHeight?: number;
};

// One run of a mixed-weight line, e.g. a bold "Re: " followed by the
// address in normal weight.
export type InlinePart = { text: string; bold?: boolean; color?: RGB };

export type TableOpts = {
  headerFill?: RGB;
  zebra?: boolean;
  centerColumns?: number[];
  rowHeight?: number;
};

export class Layout {
  doc!: PDFDocument;
  page!: PDFPage;
  regular!: PDFFont;
  bold!: PDFFont;
  y = 0;
  // Drawn at the top and bottom of every page this creates.
  header?: (l: Layout) => void;
  footer?: (l: Layout) => void;

  static async create() {
    const l = new Layout();
    l.doc = await PDFDocument.create();
    l.regular = await l.doc.embedFont(StandardFonts.Helvetica);
    l.bold = await l.doc.embedFont(StandardFonts.HelveticaBold);
    return l;
  }

  get contentWidth() {
    return A4[0] - MARGIN * 2;
  }

  font(bold?: boolean) {
    return bold ? this.bold : this.regular;
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN_TOP;
    this.header?.(this);
    this.footer?.(this);
    return this.page;
  }

  // Starts a fresh page unless the current one is still empty, so a
  // deliberate page break never leaves a blank sheet behind.
  pageBreak() {
    if (!this.page || this.y < A4[1] - MARGIN_TOP - 1) this.newPage();
  }

  ensure(space: number) {
    if (!this.page) this.newPage();
    else if (this.y - space < MARGIN_BOTTOM + 4) this.newPage();
  }

  // Splits text to fit a width, honouring newlines the caller put in.
  wrap(text: string, width: number, size: number, bold?: boolean): string[] {
    const font = this.font(bold);
    const out: string[] = [];
    for (const paragraph of String(text ?? "").split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > width && line) {
          out.push(line);
          line = word;
        } else {
          line = candidate;
        }
        // A single word too wide for the measure has no break point of
        // its own — a long reference number in a narrow table column,
        // say. Left whole it overruns the cell border into the next
        // column, so break it across lines by character.
        while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
          let fit = line.length - 1;
          while (fit > 1 && font.widthOfTextAtSize(line.slice(0, fit), size) > width) fit--;
          out.push(line.slice(0, fit));
          line = line.slice(fit);
        }
      }
      out.push(line);
    }
    return out.length ? out : [""];
  }

  // Draws one line with the gaps between words stretched so it fills the
  // measure exactly. Done with the PDF word-spacing operator rather than
  // by placing each word at its own coordinate: the line stays a single
  // string with real spaces in it, so the finished document still copies,
  // searches and reads aloud correctly.
  private drawJustified(line: string, x: number, width: number, size: number, bold: boolean | undefined, color: RGB) {
    const font = this.font(bold);
    const spaces = (line.match(/ /g) || []).length;
    const extra = spaces ? (width - font.widthOfTextAtSize(line, size)) / spaces : 0;
    this.page.pushOperators(setWordSpacing(extra));
    this.page.drawText(line, { x, y: this.y, size, font, color });
    this.page.pushOperators(setWordSpacing(0));
  }

  text(content: string, opts: TextOpts = {}) {
    const size = opts.size ?? BODY_SIZE;
    const width = opts.width ?? this.contentWidth;
    const x = opts.x ?? MARGIN;
    const lineHeight = opts.lineHeight ?? size * (opts.letter ? LETTER_LINE_FACTOR : LINE_FACTOR);
    const font = this.font(opts.bold);
    const color = opts.color ?? INK;

    // Wrapped one source paragraph at a time, because justification has
    // to leave each paragraph's *last* line ragged — stretching it would
    // spray a three-word closing line across the whole measure.
    for (const paragraph of String(content ?? "").split("\n")) {
      const lines = this.wrap(paragraph, width, size, opts.bold);
      lines.forEach((line, i) => {
        this.ensure(lineHeight);
        this.y -= lineHeight;
        if (opts.justify && i < lines.length - 1 && line.includes(" ")) {
          this.drawJustified(line, x, width, size, opts.bold, color);
          return;
        }
        let lineX = x;
        if (opts.align === "right") lineX = x + width - font.widthOfTextAtSize(line, size);
        else if (opts.align === "center") lineX = x + (width - font.widthOfTextAtSize(line, size)) / 2;
        this.page.drawText(line, { x: lineX, y: this.y, size, font, color });
      });
    }
    this.y -= opts.gapAfter ?? SPACE_AFTER;
  }

  // A section heading: 13pt, the same blue as the Word document, ruled
  // underneath, 12pt of air above it and 6pt below.
  heading(content: string, opts: { size?: number; rule?: boolean; gapBefore?: number } = {}) {
    const rule = opts.rule ?? true;
    this.ensure((opts.gapBefore ?? HEADING_BEFORE) + HEADING_SIZE * LINE_FACTOR + 14);
    this.y -= opts.gapBefore ?? HEADING_BEFORE;
    this.text(content, { size: opts.size ?? HEADING_SIZE, bold: true, color: HEADING_COLOR, gapAfter: rule ? 3 : SPACE_AFTER });
    if (rule) this.rule();
  }

  // The document's own title, with an optional subtitle inside the same
  // ruled block — a project reference, or the Act it's issued under.
  documentTitle(content: string, opts: { subtitle?: string | string[]; center?: boolean } = {}) {
    const subtitles = (Array.isArray(opts.subtitle) ? opts.subtitle : opts.subtitle ? [opts.subtitle] : []).filter(Boolean);
    const align = opts.center ? "center" : "left";
    this.ensure(TITLE_SIZE * LINE_FACTOR + subtitles.length * (SMALL_SIZE * LINE_FACTOR) + 24);
    this.text(content, { size: TITLE_SIZE, bold: true, color: HEADING_COLOR, align, gapAfter: subtitles.length ? 2 : 3 });
    subtitles.forEach((line, i) => this.text(line, { size: SMALL_SIZE, color: MUTED, align, gapAfter: i === subtitles.length - 1 ? 3 : 2 }));
    this.rule();
    this.y -= 2;
  }

  rule(color = LINE, thickness = 0.5) {
    this.ensure(6);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness, color });
    this.y -= 8;
  }

  // The hairline above a letter's closing block. The rule itself separates
  // the closing from the body, so it needs no extra air above it.
  signatureRule() {
    this.y -= 3;
    this.rule();
  }

  // The signatory's name, then their title and firm.
  signatory(name: string, ...lines: string[]) {
    this.text(name || "—", { size: SIGNATURE_NAME_SIZE, bold: true, gapAfter: 1, letter: true });
    lines.filter(Boolean).forEach((line) => this.text(line, { color: MUTED, gapAfter: 1, letter: true }));
  }

  // The name and address at the top of a letter: one block, set tight, with
  // a paragraph's worth of air only under the last line.
  addressBlock(lines: string[]) {
    lines.filter(Boolean).forEach((line, i) => this.text(line, { gapAfter: i === lines.length - 1 ? SPACE_AFTER : 0, letter: true }));
  }

  gap(amount = 8) {
    this.y -= amount;
  }

  // A bold, right-aligned label beside its value, both wrapping
  // independently — the shape every certificate field uses.
  fieldRow(label: string, value: string, labelWidth = this.contentWidth * 0.28) {
    const size = BODY_SIZE;
    const lead = size * LINE_FACTOR;
    const valueWidth = this.contentWidth - labelWidth - 8;
    const labelLines = this.wrap(label, labelWidth, size, true);
    const valueLines = this.wrap(value || "—", valueWidth, size);
    const rows = Math.max(labelLines.length, valueLines.length);
    const height = Math.max(rows * lead + 4, ROW_HEIGHT);
    this.ensure(height);

    const top = this.y;
    labelLines.forEach((line, i) => {
      const w = this.bold.widthOfTextAtSize(line, size);
      this.page.drawText(line, { x: MARGIN + labelWidth - w, y: top - lead + 2 - i * lead, size, font: this.bold, color: INK });
    });
    valueLines.forEach((line, i) => {
      this.page.drawText(line, { x: MARGIN + labelWidth + 8, y: top - lead + 2 - i * lead, size, font: this.regular, color: INK });
    });
    this.y = top - height;
  }

  // A bordered table whose column widths are percentages of the content
  // width. Rows that don't fit carry the header onto the next page.
  table(headers: string[], rows: string[][], widthsPct: number[], opts: TableOpts = {}) {
    const size = BODY_SIZE;
    const lead = size * LINE_FACTOR;
    const widths = widthsPct.map((pct) => (this.contentWidth * pct) / 100);
    const centered = new Set(opts.centerColumns ?? []);
    const minHeight = opts.rowHeight ?? ROW_HEIGHT;

    const drawRow = (cells: string[], bold: boolean, fill: RGB | null) => {
      const wrapped = cells.map((c, i) => this.wrap(c || "—", widths[i] - CELL_PAD * 2, size, bold));
      const height = Math.max(Math.max(...wrapped.map((w) => w.length)) * lead + CELL_PAD * 2, minHeight);
      this.ensure(height);

      const top = this.y;
      if (fill) this.page.drawRectangle({ x: MARGIN, y: top - height, width: this.contentWidth, height, color: fill });
      let x = MARGIN;
      wrapped.forEach((lines, i) => {
        this.page.drawRectangle({ x, y: top - height, width: widths[i], height, borderColor: GRID_LINE, borderWidth: bold ? 0.5 : 0.25 });
        lines.forEach((line, li) => {
          const w = this.font(bold).widthOfTextAtSize(line, size);
          const cellX = centered.has(i) ? x + (widths[i] - w) / 2 : x + CELL_PAD;
          this.page.drawText(line, { x: cellX, y: top - CELL_PAD - lead + 3 - li * lead, size, font: this.font(bold), color: INK });
        });
        x += widths[i];
      });
      this.y = top - height;
    };

    drawRow(headers, true, opts.headerFill ?? TABLE_HEADER_FILL);
    rows.forEach((row, i) => drawRow(row, false, opts.zebra && i % 2 === 1 ? ZEBRA_FILL : null));
    this.y -= SPACE_AFTER;
  }

  // A line built from runs of different weights — a bold label followed
  // by its value, the shape every "Re:" and "Certificate No.:" line in the
  // letters takes. Wraps by word, keeping each word in its own weight.
  inline(parts: InlinePart[], opts: { size?: number; gapAfter?: number; width?: number; x?: number } = {}) {
    const size = opts.size ?? BODY_SIZE;
    const width = opts.width ?? this.contentWidth;
    const x = opts.x ?? MARGIN;
    const lead = size * LINE_FACTOR;

    type Token = { text: string; bold?: boolean; color?: RGB; width: number; space: boolean };
    const tokens: Token[] = [];
    for (const part of parts) {
      for (const chunk of part.text.split(/(\s+)/)) {
        if (!chunk) continue;
        tokens.push({
          text: chunk,
          bold: part.bold,
          color: part.color,
          width: this.font(part.bold).widthOfTextAtSize(chunk, size),
          space: /^\s+$/.test(chunk),
        });
      }
    }

    const lines: Token[][] = [[]];
    let used = 0;
    for (const token of tokens) {
      if (!token.space && used + token.width > width && used > 0) {
        lines.push([]);
        used = 0;
      }
      // A space that would start a wrapped line is dropped, so the text
      // still lines up with the left margin.
      if (token.space && used === 0) continue;
      lines[lines.length - 1].push(token);
      used += token.width;
    }

    for (const line of lines) {
      this.ensure(lead);
      this.y -= lead;
      let cursor = x;
      // Neighbouring words in the same weight are drawn as one string, not
      // one call each: a PDF reader reconstructs the spaces between words
      // from what is inside a drawn string, so word-by-word placement would
      // read back as "YagoonaNSW" however right it looked on the page.
      let run = "";
      let runStart = x;
      let runStyle: { bold?: boolean; color?: RGB } | null = null;
      const flush = () => {
        if (run.trim()) this.page.drawText(run, { x: runStart, y: this.y, size, font: this.font(runStyle?.bold), color: runStyle?.color ?? INK });
        run = "";
      };
      for (const token of line) {
        const sameStyle = runStyle && runStyle.bold === token.bold && runStyle.color === token.color;
        if (!sameStyle) {
          flush();
          runStart = cursor;
          runStyle = { bold: token.bold, color: token.color };
        }
        run += token.text;
        cursor += token.width;
      }
      flush();
    }
    this.y -= opts.gapAfter ?? SPACE_AFTER;
  }

  // The amber box the letters put their "you must provide" list in. The
  // height has to be measured before anything is drawn, because the
  // background rectangle goes down first and the text sits on top of it.
  callout(body: string, bullets: string[] = [], opts: { size?: number; bold?: boolean } = {}) {
    const size = opts.size ?? BODY_SIZE;
    const lead = size * LINE_FACTOR;
    const pad = 7;
    const inner = this.contentWidth - pad * 2;

    const bodyLines = body ? this.wrap(body, inner, size, opts.bold) : [];
    const bulletLines = bullets.map((b) => this.wrap(`\u2022  ${b}`, inner - 10, size));
    const rows = bodyLines.length + bulletLines.reduce((n, l) => n + l.length, 0);
    const height = rows * lead + pad * 2;
    this.ensure(height + 4);

    const top = this.y;
    this.page.drawRectangle({ x: MARGIN, y: top - height, width: this.contentWidth, height, color: CALLOUT_FILL, borderColor: CALLOUT_BORDER, borderWidth: 0.5 });

    let cursor = top - pad;
    const draw = (line: string, indent: number, bold?: boolean) => {
      cursor -= lead;
      this.page.drawText(line, { x: MARGIN + pad + indent, y: cursor + 3, size, font: this.font(bold), color: INK });
    };
    bodyLines.forEach((line) => draw(line, 0, opts.bold));
    bulletLines.forEach((lines) => lines.forEach((line, i) => draw(line, i === 0 ? 6 : 16)));

    this.y = top - height - SPACE_AFTER;
  }

  bullet(text: string) {
    this.text(`•  ${text}`, { x: MARGIN + 8, width: this.contentWidth - 8, gapAfter: 3 });
  }

  async image(bytes: Uint8Array, type: "png" | "jpeg", targetHeight: number) {
    const embedded = type === "png" ? await this.doc.embedPng(bytes) : await this.doc.embedJpg(bytes);
    const scale = targetHeight / embedded.height;
    const width = Math.min(embedded.width * scale, this.contentWidth);
    const height = embedded.height * (width / embedded.width);
    this.ensure(height + 4);
    this.y -= height;
    this.page.drawImage(embedded, { x: MARGIN, y: this.y, width, height });
    this.y -= 4;
  }

  save() {
    return this.doc.save();
  }
}
