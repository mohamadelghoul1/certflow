import type { JobField } from "@/lib/import/jobColumns";

// Working out what columns hold when the spreadsheet has no headings.
//
// A certifier copying a few rows out of their old system rarely brings
// the heading row with them, and refusing that paste is refusing the
// most natural way to try this. So when there are no headings to read,
// the values themselves are read instead: a four-digit number after a
// state is a postcode, "DP36608" is a plan, "$200,000.00" is the cost,
// "Canterbury-Bankstown Council" is the council.
//
// Where a guess would be a coin toss it is not made at all — a column
// left unread is visible in the preview and fixable, while a column read
// wrongly is a job with someone else's details on it.

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const STREET_WORD = /\b(street|st|road|rd|drive|dr|avenue|ave|way|lane|place|pl|court|ct|crescent|cres|parade|pde|close|terrace|circuit|boulevard|highway|esplanade|grove|rise|view|walk|square|loop|mews|parkway)\b/i;

export type Kind =
  | "money"
  | "state"
  | "fourDigits"
  | "date"
  | "certificateType"
  | "classification"
  | "plan"
  | "certificateNumber"
  | "reference"
  | "council"
  | "address"
  | "streetName"
  | "personName"
  | "number"
  | "text"
  | "blank";

export function classify(value: string): Kind {
  const v = (value || "").trim();
  if (!v) return "blank";
  // Money before anything numeric: a dollar sign or thousands separator
  // is unambiguous, where a bare number is not.
  if (/^\$?\s?\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(v) || /^\$\s?\d+(\.\d{1,2})?$/.test(v)) return "money";
  if (new RegExp(`^(${STATES.join("|")})$`, "i").test(v)) return "state";
  if (/^\d{1,2}\/\d{1,2}\/\d{4}([\s,]|$)/.test(v) || /^\d{4}-\d{2}-\d{2}([\sT]|$)/.test(v)) return "date";
  if (/certificate$/i.test(v) && /complying|construction|occupation|subdivision/i.test(v)) return "certificateType";
  if (/^(DP|SP|CP)\s?\d+$/i.test(v)) return "plan";
  // A certificate number carries a series and a suffix; a bare series
  // and number is the case reference the system files it under.
  if (/^(CDC|CC|CFT|PCA|OC)[-\s]?[\w.]+\/[\w.]+$/i.test(v)) return "certificateNumber";
  if (/^(CDC|CC|CFT|PCA|OC)[-\s]?[\w.]+$/i.test(v)) return "reference";
  if (/(council|^city of |shire|municipal)/i.test(v)) return "council";
  // A classification needs a letter or a list — otherwise "27" would
  // pass for one.
  if (/^\d{1,2}[a-z](\s*,\s*\d{1,2}[a-z]?)*$/i.test(v) || /^\d{1,2}[a-z]?(\s*,\s*\d{1,2}[a-z]?)+$/i.test(v)) return "classification";
  if (/^\d{4}$/.test(v)) return "fourDigits";
  if (/^\d+[a-z]?$/i.test(v)) return "number";
  if (STREET_WORD.test(v) && /\d/.test(v) && (v.includes(",") || v.split(/\s+/).length >= 3)) return "address";
  if (STREET_WORD.test(v)) return "streetName";
  if (/^[A-Za-z][A-Za-z'’\-.]*(\s+[A-Za-z][A-Za-z'’\-.]*)+$/.test(v) && v.split(/\s+/).length <= 4) return "personName";
  return "text";
}

// The kind a whole column is, taken from the values that are actually
// filled in — one blank cell should not make a column unreadable.
export function columnKind(values: string[]): Kind {
  const kinds = values.map(classify).filter((kind) => kind !== "blank");
  if (kinds.length === 0) return "blank";
  const counts = new Map<Kind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Which column is which, decided from the values. certifierNames lets a
// column of the firm's own certifiers be told apart from the applicant
// and the owner, who are otherwise identical in shape.
export function inferColumns(rows: string[][], certifierNames: string[] = []): Partial<Record<JobField, number>> {
  const width = Math.max(...rows.map((row) => row.length), 0);
  const columnAt = (i: number) => rows.map((row) => (row[i] || "").trim());
  const kinds: Kind[] = [];
  for (let i = 0; i < width; i++) kinds.push(columnKind(columnAt(i)));

  const found: Partial<Record<JobField, number>> = {};
  const taken = new Set<number>();
  const claim = (field: JobField, index: number | undefined) => {
    if (index === undefined || index < 0 || taken.has(index) || found[field] !== undefined) return;
    found[field] = index;
    taken.add(index);
  };
  const firstOf = (kind: Kind) => kinds.findIndex((k, i) => k === kind && !taken.has(i));

  // The unambiguous ones first, so the positional reasoning below stands
  // on settled ground.
  claim("estimatedCost", firstOf("money"));
  claim("approvalDate", firstOf("date"));
  claim("approvalType", firstOf("certificateType"));
  claim("classification", firstOf("classification"));
  claim("lga", firstOf("council"));
  claim("approvalNumber", firstOf("certificateNumber"));
  claim("address", firstOf("address"));

  // The address block: the state anchors it, and the parts sit around it
  // in the order every export writes them.
  const stateAt = kinds.findIndex((k) => k === "state");
  if (stateAt >= 0) {
    claim("applicantState", stateAt);
    if (kinds[stateAt + 1] === "fourDigits") claim("applicantPostcode", stateAt + 1);
    if (stateAt - 1 >= 0 && ["text", "personName", "streetName"].includes(kinds[stateAt - 1])) claim("applicantSuburb", stateAt - 1);
    if (stateAt - 2 >= 0 && ["streetName", "text", "address"].includes(kinds[stateAt - 2])) claim("applicantStreet", stateAt - 2);
    if (stateAt - 3 >= 0 && ["number", "text"].includes(kinds[stateAt - 3])) claim("applicantStreetNumber", stateAt - 3);
  }

  // Lot and plan: the plan is unmistakable, and the lot is the plain
  // number sitting beside it.
  const planAt = kinds.findIndex((k) => k === "plan");
  if (planAt >= 0) {
    claim("plan", planAt);
    if (planAt - 1 >= 0 && kinds[planAt - 1] === "number") claim("lot", planAt - 1);
    else if (kinds[planAt + 1] === "number") claim("lot", planAt + 1);
  }

  // Names: a column of the firm's own certifiers is the certifier, and
  // of the rest the first is the applicant and the second the owner —
  // the order every system writes them in.
  const known = new Set(certifierNames.map((name) => name.trim().toLowerCase()).filter(Boolean));
  const nameColumns: number[] = [];
  for (let i = 0; i < width; i++) {
    if (taken.has(i) || kinds[i] !== "personName") continue;
    const values = columnAt(i).filter(Boolean);
    const isCertifier = values.length > 0 && values.every((value) => known.has(value.toLowerCase()));
    if (isCertifier) claim("certifierName", i);
    else nameColumns.push(i);
  }
  claim("applicantName", nameColumns[0]);
  claim("ownerName", nameColumns[1]);

  claim("reference", firstOf("reference"));

  return found;
}
