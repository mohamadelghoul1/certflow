// One cell of a CSV, safe to open in a spreadsheet.
//
// Two separate problems, and the second is the one that bites.
//
// Quoting keeps a value with a comma, a quote or a line break in one
// cell instead of spilling into three.
//
// Neutralising keeps a value from being run as a formula. Excel, Google
// Sheets and LibreOffice all treat a cell beginning with =, +, - or @
// (and the DDE variants behind a tab or carriage return) as a formula
// rather than text, so a client who names themselves
// `=HYPERLINK("http://…","Click")` — or worse — has written a live
// formula into the register a certifier later opens. These exports carry
// addresses, client names and invoice references, all typed by people,
// some of them by clients. Prefixing a tab-quote pair is the standard
// answer: the spreadsheet stores it as text, and what is displayed is
// the value itself.

const FORMULA_LEAD = /^[=+\-@\t\r]/;
// A negative number is not a formula, and an accounting export is full
// of them — a credit line arriving as the text "'-50.00" is an import
// Xero rejects. Plain numbers are left exactly as they are.
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = FORMULA_LEAD.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(",");
}
