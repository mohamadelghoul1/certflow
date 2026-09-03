import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { TEMPLATE_COLUMNS, templateWorkbook } from "@/lib/import/template";
import { rowsFromWorkbook, rowsToPaste } from "@/lib/import/spreadsheet";
import { matchColumns } from "@/lib/import/jobColumns";
import { parsePaste } from "@/lib/import/parseTable";
import { buildPreview, looksLikeHeadings } from "@/lib/import/jobRows";

// A firm fills in the template Certlyn gave them and drops it back. The
// two promises worth holding: every heading on the template is read as
// the field it was put there for, and a workbook comes through the file
// path exactly as it would have through a paste.

describe("the template Certlyn hands out", () => {
  test("every heading on it is read back as the field it stands for", () => {
    const matched = matchColumns(TEMPLATE_COLUMNS.map((c) => c.heading));
    for (const [index, column] of TEMPLATE_COLUMNS.entries()) {
      assert.equal(matched[column.field], index, `"${column.heading}" should be read as ${column.field}`);
    }
  });

  test("it opens as a workbook with the headings on the first sheet and the guide on the second", () => {
    const book = XLSX.read(templateWorkbook(), { type: "array" });
    assert.deepEqual(book.SheetNames, ["Projects", "How to fill this in"]);
    const first = rowsFromWorkbook(templateWorkbook());
    assert.equal(first?.sheet, "Projects");
    assert.deepEqual(first?.rows[0], TEMPLATE_COLUMNS.map((c) => c.heading));
    assert.equal(first?.rows.length, 1, "no example row to forget to delete");
    const guide = XLSX.utils.sheet_to_json<string[]>(book.Sheets["How to fill this in"], { header: 1 });
    assert.ok(guide.some((row) => row[0] === "Property address" && String(row[1]).includes("must be filled in")));
  });
});

describe("reading a filled-in workbook", () => {
  function workbookWith(rows: unknown[][]): Uint8Array {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Projects");
    return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  }

  test("dates come out as dates, numbers as text, and blank rows are dropped", () => {
    const read = rowsFromWorkbook(
      workbookWith([
        ["Property address", "Approval date", "Estimated cost"],
        ["12 Example Street, Liverpool NSW 2170", new Date(Date.UTC(2025, 2, 14)), 450000],
        ["", "", ""],
        ["3 Other Road, Casula NSW 2170", "14/03/2025", "1,200"],
      ])
    );
    assert.equal(read?.rows.length, 3);
    assert.equal(read?.rows[1][1], "2025-03-14");
    assert.equal(read?.rows[1][2], "450000");
    assert.equal(read?.rows[2][1], "14/03/2025");
  });

  test("the first sheet with anything on it is the one read", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[]]), "Notes");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Property address"], ["1 Real St"]]), "Jobs");
    const bytes = new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    assert.equal(rowsFromWorkbook(bytes)?.sheet, "Jobs");
    assert.equal(rowsFromWorkbook(workbookWith([[]])), null);
  });

  test("a workbook becomes the paste it would have been, quotes and all, and imports the same", () => {
    const rows = rowsFromWorkbook(
      workbookWith([
        TEMPLATE_COLUMNS.map((c) => c.heading),
        TEMPLATE_COLUMNS.map((c) => (c.field === "description" ? 'Dwelling with "granny flat"\nand pool' : c.example)),
      ])
    )!;
    const paste = rowsToPaste(rows.rows);
    assert.ok(paste.includes('"Dwelling with ""granny flat""\nand pool"'), "a cell with a quote and a line break is quoted the way Excel does");

    const parsed = parsePaste(paste, looksLikeHeadings)!;
    assert.deepEqual(parsed.headers, TEMPLATE_COLUMNS.map((c) => c.heading));
    const preview = buildPreview(parsed, ["Mohamad El Ghoul"]);
    assert.equal(preview.jobs.length, 1);
    assert.equal(preview.jobs[0].address, "12 Example Street, Liverpool NSW 2170");
    assert.equal(preview.jobs[0].description, 'Dwelling with "granny flat"\nand pool');
    assert.equal(preview.jobs[0].details.priorApproval?.number, "CDC-2025/0412");
    assert.equal(preview.unmatchedHeadings.length, 0, "nothing on the template is left behind");
  });
});
