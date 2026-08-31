import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvRow } from "@/lib/csv";
import { registerCsv } from "@/lib/issuanceRegister";

// The register and the Xero export are opened in a spreadsheet, and the
// names and addresses in them are typed by people — some of them by
// clients, through the portal. A cell that begins like a formula is run
// as one unless it is neutralised.
describe("a CSV cell", () => {
  test("neutralises anything a spreadsheet would run as a formula", () => {
    for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
      const cell = csvCell(`${lead}HYPERLINK("http://evil","Click")`);
      assert.ok(cell.replace(/^"/, "").startsWith("'"), `${JSON.stringify(lead)} was left runnable`);
    }
  });

  // An accounting export is full of negative numbers. A credit arriving
  // as text is an import the accounting package rejects.
  test("leaves a negative number as a number", () => {
    assert.equal(csvCell("-50.00"), "-50.00");
    assert.equal(csvCell("-3"), "-3");
    assert.equal(csvCell(-50), "-50");
    // Still not a licence for anything else that starts with a dash.
    assert.equal(csvCell("-50 credit note"), "'-50 credit note");
  });

  test("leaves ordinary text exactly as it is", () => {
    assert.equal(csvCell("21 Coquet Way, Green Valley"), '"21 Coquet Way, Green Valley"');
    assert.equal(csvCell("CDC-26001/01"), "CDC-26001/01");
    assert.equal(csvCell(""), "");
    assert.equal(csvCell(null), "");
  });

  test("keeps a value with a comma, quote or line break in one cell", () => {
    assert.equal(csvCell('He said "hello"'), '"He said ""hello"""');
    assert.equal(csvCell("line one\nline two"), '"line one\nline two"');
  });

  test("a row joins its cells with commas", () => {
    assert.equal(csvRow(["a", "b,c", 2]), 'a,"b,c",2');
  });
});

describe("the issuance register CSV", () => {
  test("carries a formula-shaped client name as text", () => {
    // applicantName is one of the fields a client can set themselves,
    // through the portal's contact details.
    const csv = registerCsv([
      { date: "2026-08-24", certType: "CDC", certNumber: "CDC-26001/01", address: "21 Coquet Way", applicantName: '=cmd|"/c calc"!A1' } as never,
    ]);
    assert.ok(!csv.includes(",=cmd"), "a formula reached the file unneutralised");
    assert.ok(csv.includes("'=cmd") || csv.includes("\"'=cmd"), "the value is still there, as text");
  });
});
