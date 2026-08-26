// Reading a spreadsheet the way it actually arrives.
//
// A certifier moving off another system exports a list of jobs and
// pastes it in. What lands is whatever that system produced: tabs from
// Excel, commas from a CSV, quoted fields with commas and line breaks
// inside them, a trailing blank line. This reads all of it without
// asking anyone to tidy it first.

export type Table = { headers: string[]; rows: string[][] };

// Tab or comma, decided by which one appears more often outside quotes on
// the first line — a guess, but one that is right for every export either
// system produces.
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || "";
  let tabs = 0;
  let commas = 0;
  let inQuotes = false;
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char === "\t") tabs++;
    else if (!inQuotes && char === ",") commas++;
  }
  return tabs > commas ? "\t" : ",";
}

// A field may hold the delimiter, a line break, or a doubled quote
// standing for a literal one — all of which a naive split on commas
// would tear apart, silently shifting every later column by one.
export function parseDelimited(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endField = () => {
    row.push(field.trim());
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === delimiter) endField();
    else if (char === "\n") endRow();
    else if (char !== "\r") field += char;
  }
  if (field !== "" || row.length > 0) endRow();

  return rows;
}

export function parseTable(text: string): Table | null {
  const rows = parseDelimited(text);
  if (rows.length < 2) return null;
  return { headers: rows[0], rows: rows.slice(1) };
}
