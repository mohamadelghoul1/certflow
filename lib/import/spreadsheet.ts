import * as XLSX from "xlsx";

// Reading a spreadsheet file into the rows the import already knows how
// to read.
//
// The import was built around pasting, and the paste path is kept: it
// is still the quickest way to bring six jobs across from a screen. But
// a whole practice lives in a workbook, and "open it, select
// everything, copy" is three steps too many for a file that could just
// be dropped. So the file is read here — in the browser, where the
// certifier can see the preview the moment it lands — and turned into
// exactly what a paste would have been, so nothing downstream changes.

export type SheetRows = { sheet: string; rows: string[][] };

// The first sheet that has anything on it, as text.
//
// Each cell is read the way a person sees it — the formatted text, so a
// phone number typed as 0400 000 000 keeps its leading zero — except a
// date, which is written out as year-month-day whatever the column's
// display format was. Excel's own short format is "3/14/25", which the
// date reader would have to guess at, and 3/4/25 guessed wrong is a
// certificate with the wrong determination date on it.
function cellText(cell: XLSX.CellObject): string {
  if (cell.t === "d" && cell.v instanceof Date) {
    const d = cell.v;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (typeof cell.w === "string") return cell.w.trim();
  return cell.v === null || cell.v === undefined ? "" : String(cell.v).trim();
}

export function rowsFromWorkbook(data: ArrayBuffer | Uint8Array): SheetRows | null {
  const book = XLSX.read(data, { type: "array", cellDates: true });
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    if (!sheet || !sheet["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const rows: string[][] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        row.push(cell ? cellText(cell) : "");
      }
      if (row.some((cell) => cell !== "")) rows.push(row);
    }
    if (rows.length > 0) return { sheet: name, rows };
  }
  return null;
}

// The rows as a tab-separated paste. A cell holding a tab, a line break
// or a quote is quoted the way Excel would, and the paste reader already
// understands that.
export function rowsToPaste(rows: string[][]): string {
  const quote = (cell: string) => (/[\t\n\r"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  return rows.map((row) => row.map(quote).join("\t")).join("\n");
}

export function isSpreadsheetFile(name: string): boolean {
  return /\.(xlsx|xlsm|xls|ods)$/i.test(name);
}

export function isTextFile(name: string): boolean {
  return /\.(csv|tsv|txt)$/i.test(name);
}
