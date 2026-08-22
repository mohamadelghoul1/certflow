import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

// A small layout engine over pdf-lib.
//
// pdf-lib draws text at coordinates and nothing more — no wrapping, no
// tables, no flowing onto a new page. The certificate package needs all
// three, so this adds them: a cursor that moves down the page, text that
// wraps to a width, label/value rows, bordered tables, and a page break
// when the cursor runs out of room.
//
// It exists because the approved set has to be a PDF. The .docx builder
// can't be reused for it — Word documents can't be merged into a PDF
// without converting them, which needs software this doesn't have.

export const A4: [number, number] = [595.28, 841.89];
export const MARGIN = 46;

export const INK = rgb(0.06, 0.09, 0.16);
export const MUTED = rgb(0.42, 0.45, 0.5);
export const LINE = rgb(0.78, 0.81, 0.85);
export const HEADRULE = rgb(0.12, 0.16, 0.22);

export type TextOpts = {
  size?: number;
  bold?: boolean;
  color?: RGB;
  align?: "left" | "right" | "center";
  width?: number;
  x?: number;
  gapAfter?: number;
  lineHeight?: number;
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
    this.y = A4[1] - MARGIN;
    this.header?.(this);
    this.footer?.(this);
    return this.page;
  }

  // Starts a fresh page unless the current one is still empty, so a
  // deliberate page break never leaves a blank sheet behind.
  pageBreak() {
    if (!this.page || this.y < A4[1] - MARGIN - 1) this.newPage();
  }

  ensure(space: number) {
    if (!this.page) this.newPage();
    else if (this.y - space < MARGIN + 24) this.newPage();
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
      }
      out.push(line);
    }
    return out.length ? out : [""];
  }

  text(content: string, opts: TextOpts = {}) {
    const size = opts.size ?? 9;
    const width = opts.width ?? this.contentWidth;
    const x = opts.x ?? MARGIN;
    const lineHeight = opts.lineHeight ?? size + 3.5;
    const font = this.font(opts.bold);

    for (const line of this.wrap(content, width, size, opts.bold)) {
      this.ensure(lineHeight);
      let lineX = x;
      if (opts.align === "right") lineX = x + width - font.widthOfTextAtSize(line, size);
      else if (opts.align === "center") lineX = x + (width - font.widthOfTextAtSize(line, size)) / 2;
      this.y -= lineHeight;
      this.page.drawText(line, { x: lineX, y: this.y, size, font, color: opts.color ?? INK });
    }
    this.y -= opts.gapAfter ?? 6;
  }

  heading(content: string, opts: { size?: number; rule?: boolean; gapBefore?: number } = {}) {
    this.y -= opts.gapBefore ?? 8;
    this.text(content, { size: opts.size ?? 10, bold: true, gapAfter: opts.rule ? 3 : 5 });
    if (opts.rule) this.rule();
  }

  rule(color = LINE, thickness = 0.7) {
    this.ensure(6);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness, color });
    this.y -= 8;
  }

  gap(amount = 8) {
    this.y -= amount;
  }

  // A bold label beside its value, both wrapping independently — the
  // shape every certificate field uses.
  fieldRow(label: string, value: string, labelWidth = 165) {
    const size = 9;
    const valueWidth = this.contentWidth - labelWidth - 8;
    const labelLines = this.wrap(label, labelWidth, size, true);
    const valueLines = this.wrap(value || "—", valueWidth, size);
    const rows = Math.max(labelLines.length, valueLines.length);
    this.ensure(rows * 12.5 + 4);

    const top = this.y;
    labelLines.forEach((line, i) => {
      this.page.drawText(line, { x: MARGIN, y: top - 10 - i * 12.5, size, font: this.bold, color: INK });
    });
    valueLines.forEach((line, i) => {
      this.page.drawText(line, { x: MARGIN + labelWidth + 8, y: top - 10 - i * 12.5, size, font: this.regular, color: INK });
    });
    this.y = top - rows * 12.5 - 4;
  }

  // A bordered table whose column widths are percentages of the content
  // width. Rows that don't fit carry the header onto the next page.
  table(headers: string[], rows: string[][], widthsPct: number[]) {
    const size = 8;
    const pad = 4;
    const widths = widthsPct.map((p) => (this.contentWidth * p) / 100);

    const drawRow = (cells: string[], bold: boolean, shaded: boolean) => {
      const wrapped = cells.map((c, i) => this.wrap(c || "—", widths[i] - pad * 2, size, bold));
      const height = Math.max(...wrapped.map((w) => w.length)) * (size + 3) + pad * 2;
      this.ensure(height);

      const top = this.y;
      if (shaded) {
        this.page.drawRectangle({ x: MARGIN, y: top - height, width: this.contentWidth, height, color: rgb(0.95, 0.96, 0.97) });
      }
      let x = MARGIN;
      wrapped.forEach((lines, i) => {
        this.page.drawRectangle({ x, y: top - height, width: widths[i], height, borderColor: LINE, borderWidth: 0.6 });
        lines.forEach((line, li) => {
          this.page.drawText(line, { x: x + pad, y: top - pad - (size + 1) - li * (size + 3), size, font: this.font(bold), color: INK });
        });
        x += widths[i];
      });
      this.y = top - height;
    };

    drawRow(headers, true, true);
    for (const row of rows) drawRow(row, false, false);
    this.y -= 8;
  }

  bullet(text: string) {
    this.text(`•  ${text}`, { x: MARGIN + 8, width: this.contentWidth - 8, gapAfter: 2 });
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
