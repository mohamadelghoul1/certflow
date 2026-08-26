import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseDelimited, parseTable, parsePaste, detectDelimiter } from "@/lib/import/parseTable";
import { matchColumns } from "@/lib/import/jobColumns";
import { splitAddress } from "@/lib/import/address";
import { buildPreview, looksLikeHeadings } from "@/lib/import/jobRows";

// A certifier moving off another system pastes in a list of every job
// they hold. A parser that quietly shifts a column by one, or drops a
// suburb, corrupts hundreds of projects at once and nobody notices until
// a certificate prints wrong. So this is held to the messy reality of
// exported spreadsheets.

describe("reading the pasted spreadsheet", () => {
  test("takes tab-separated text, which is what pasting from Excel gives", () => {
    assert.equal(detectDelimiter("Address\tScope\tCouncil"), "\t");
    const rows = parseDelimited("Address\tScope\n21 Coquet Way\tNew dwelling");
    assert.deepEqual(rows, [
      ["Address", "Scope"],
      ["21 Coquet Way", "New dwelling"],
    ]);
  });

  test("takes comma-separated text too", () => {
    assert.equal(detectDelimiter("Address,Scope,Council"), ",");
    const rows = parseDelimited("Address,Scope\n21 Coquet Way,New dwelling");
    assert.equal(rows[1][1], "New dwelling");
  });

  // The failure that silently ruins an import: a comma inside a quoted
  // address shifting every later column by one.
  test("a comma inside a quoted field does not split it", () => {
    const rows = parseDelimited('Address,Council\n"21 Coquet Way, Green Valley",Liverpool');
    assert.deepEqual(rows[1], ["21 Coquet Way, Green Valley", "Liverpool"]);
  });

  test("a line break inside a quoted field does not end the row", () => {
    const rows = parseDelimited('Address,Scope\n"21 Coquet Way","New dwelling\nand pool"');
    assert.equal(rows.length, 2);
    assert.equal(rows[1][1], "New dwelling\nand pool");
  });

  test("a doubled quote inside a field is one literal quote", () => {
    const rows = parseDelimited('Name\n"The ""Grove"" Trust"');
    assert.equal(rows[1][0], 'The "Grove" Trust');
  });

  test("trailing blank lines are not imported as empty jobs", () => {
    const table = parseTable("Address,Scope\n21 Coquet Way,New dwelling\n\n\n");
    assert.equal(table?.rows.length, 1);
  });

  test("a heading row on its own is not a spreadsheet of jobs", () => {
    assert.equal(parseTable("Address,Scope"), null);
    assert.equal(parseTable(""), null);
  });
});

describe("working out what the columns mean", () => {
  test("recognises the headings other systems actually use", () => {
    const matched = matchColumns(["Site Address", "Scope of Works", "LGA", "CDC Number", "Client Name"]);
    assert.equal(matched.address, 0);
    assert.equal(matched.description, 1);
    assert.equal(matched.lga, 2);
    assert.equal(matched.approvalNumber, 3);
    assert.equal(matched.applicantName, 4);
  });

  // The trap: "Applicant Address" also contains "address", so a loose
  // match could hand the property address column to the applicant.
  test("does not confuse the applicant's address with the property's", () => {
    const matched = matchColumns(["Property Address", "Applicant Address"]);
    assert.equal(matched.address, 0);
    assert.equal(matched.applicantAddress, 1);
  });

  test("reads headings whatever their punctuation and case", () => {
    const matched = matchColumns(["SITE_ADDRESS", "scope of works", "Lot / Section / DP"]);
    assert.equal(matched.address, 0);
    assert.equal(matched.description, 1);
    assert.equal(matched.lotSectionDp, 2);
  });

  test("one column is never claimed by two fields", () => {
    const matched = matchColumns(["Address", "Address"]);
    const used = Object.values(matched);
    assert.equal(new Set(used).size, used.length);
  });

  test("says nothing rather than guessing at a heading it does not know", () => {
    const matched = matchColumns(["Widget count", "Sprocket"]);
    assert.deepEqual(matched, {});
  });
});

describe("splitting a one-line applicant address", () => {
  test("splits the ordinary shape", () => {
    assert.deepEqual(splitAddress("21 Coquet Way, Green Valley NSW 2168"), {
      streetNumber: "21",
      street: "Coquet Way",
      suburb: "Green Valley",
      state: "NSW",
      postcode: "2168",
    });
  });

  test("splits one written without a comma", () => {
    const split = splitAddress("378 Scenic Drive San Remo NSW 2262");
    assert.equal(split.street, "Scenic Drive");
    assert.equal(split.suburb, "San Remo");
  });

  test("keeps a unit or suite with the number", () => {
    assert.equal(splitAddress("Suite 2/F1 101 Rookwood Road, Yagoona NSW 2199").streetNumber, "Suite 2/F1 101");
    assert.equal(splitAddress("1/5 The Boulevarde, Lakemba NSW 2195").streetNumber, "1/5");
  });

  // A street name containing a street type would divide too early if the
  // search ran forwards.
  test("divides at the last street type, not the first", () => {
    const split = splitAddress("12A Kings Park Road, Five Dock NSW 2046");
    assert.equal(split.street, "Kings Park Road");
    assert.equal(split.suburb, "Five Dock");
  });

  test("leaves something it cannot read whole rather than mangling it", () => {
    const split = splitAddress("PO BOX 195, Blaxcell NSW 2142");
    assert.equal(split.street, "PO BOX 195");
    assert.equal(split.suburb, "Blaxcell");
    assert.equal(splitAddress("somewhere vague").street, "somewhere vague");
    assert.deepEqual(splitAddress(""), { streetNumber: "", street: "", suburb: "", state: "NSW", postcode: "" });
  });
});

describe("turning a row into a project", () => {
  const table = parseTable(
    [
      "Site Address,Scope of Works,Lot/DP,Council,Client,Client Address,CDC Number,Date Issued,Issued By,Portal Case,Class",
      '"21 Coquet Way, Green Valley",Secondary dwelling,7/DP253031,Liverpool,Sam Owner,"5 High St, Liverpool NSW 2170",CDC-26091/01,2026-05-11,Another Certifier,CFT-1007788,Class 1a',
    ].join("\n")
  )!;

  test("carries every column into the right place", () => {
    const { jobs } = buildPreview({ headers: table.headers, rows: table.rows });
    assert.equal(jobs.length, 1);
    const job = jobs[0];
    assert.equal(job.address, "21 Coquet Way, Green Valley");
    assert.equal(job.description, "Secondary dwelling");
    assert.equal(job.details.certificateDetails?.lotSectionDp, "7/DP253031");
    assert.equal(job.details.council?.lga, "Liverpool");
    assert.equal(job.details.contact?.nameOrCompany, "Sam Owner");
    assert.equal(job.details.applicantAddress?.suburb, "Liverpool");
    assert.deepEqual(job.details.proposal?.classifications, ["1a"]);
  });

  // The whole point of the import: these jobs are mid-construction, so
  // the certificate someone else issued is recorded rather than invented.
  test("records the previous certifier's approval, ready for inspections", () => {
    const { jobs } = buildPreview({ headers: table.headers, rows: table.rows });
    const prior = jobs[0].details.priorApproval;
    assert.equal(prior?.type, "CDC");
    assert.equal(prior?.number, "CDC-26091/01");
    assert.equal(prior?.issuedBy, "Another Certifier");
    // The case the Portal panel will offer when reporting an inspection.
    assert.equal(jobs[0].details.inspectionPortalCase, "CFT-1007788");
  });

  test("recognises a construction certificate when that is what was issued", () => {
    const cc = parseTable("Address,Certificate Type,Certificate Number\n1 Test St,Construction Certificate,CFT-99")!;
    assert.equal(buildPreview({ headers: cc.headers, rows: cc.rows }).jobs[0].details.priorApproval?.type, "CC");
  });

  // A migration that refuses a job over a missing postcode does not
  // happen. The gaps are reported instead.
  test("imports an incomplete row and says what is missing", () => {
    const sparse = parseTable("Address\n9 Bare St")!;
    const { jobs } = buildPreview({ headers: sparse.headers, rows: sparse.rows });
    assert.equal(jobs[0].address, "9 Bare St");
    assert.ok(jobs[0].warnings.some((w) => /scope of works/i.test(w)));
    assert.ok(jobs[0].warnings.some((w) => /cdc \/ cc number/i.test(w)));
    assert.ok(jobs[0].warnings.some((w) => /council/i.test(w)));
  });

  test("names the headings it could not place, so nothing is lost in silence", () => {
    const extra = parseTable("Address,Widget count\n1 Test St,7")!;
    assert.deepEqual(buildPreview({ headers: extra.headers, rows: extra.rows }).unmatchedHeadings, ["Widget count"]);
  });

  test("numbers the rows the way the spreadsheet does, counting its heading", () => {
    const two = parseTable("Address\n1 First St\n2 Second St")!;
    const { jobs } = buildPreview({ headers: two.headers, rows: two.rows });
    assert.deepEqual(jobs.map((j) => j.rowNumber), [2, 3]);
  });
});

// A certifier's first attempt is to copy a row or two straight out of
// their old system, which brings no heading row with it. Refusing that
// paste refuses the most natural way to try this — so the columns are
// read from the values instead. This is a real row from a real export.
describe("a paste with no heading row", () => {
  const realRow = [
    "CDC-26257",
    "27 Mundamatta Street, Villawood",
    "Mohamad El Ghoul",
    "CDC-26257/01",
    "4/08/2026 13:38",
    "Complying Development Certificate",
    "1a, 10a",
    "766",
    "DP36608",
    "Canterbury-Bankstown Council",
    "$200,000.00",
    "Behram Aslam Chattha",
    "Behram Aslam Chattha",
    "",
    "27",
    "Mundamatta Street",
    "Villawood",
    "NSW",
    "2163",
  ].join("\t");

  const preview = () => {
    const paste = parsePaste(realRow, looksLikeHeadings)!;
    return buildPreview(paste, ["Mohamad El Ghoul"]);
  };

  test("is read as data rather than refused as headings", () => {
    const paste = parsePaste(realRow, looksLikeHeadings);
    assert.ok(paste, "the paste was refused outright");
    assert.equal(paste!.headers, null, "a row of data was mistaken for headings");
    assert.equal(paste!.rows.length, 1);
    assert.equal(preview().inferred, true);
  });

  test("finds the property address and the scope", () => {
    const job = preview().jobs[0];
    assert.equal(job.address, "27 Mundamatta Street, Villawood");
  });

  test("finds the certificate, its date and its type", () => {
    const { priorApproval } = preview().jobs[0].details;
    assert.equal(priorApproval?.number, "CDC-26257/01");
    assert.equal(priorApproval?.type, "CDC");
    assert.equal(priorApproval?.date, "4/08/2026 13:38");
  });

  // Lot and plan arrive as two columns and print as one line.
  test("joins the lot and the plan", () => {
    assert.equal(preview().jobs[0].details.certificateDetails?.lotSectionDp, "766 / DP36608");
  });

  test("finds the council, the classification and the cost", () => {
    const details = preview().jobs[0].details;
    assert.equal(details.council?.lga, "Canterbury-Bankstown Council");
    assert.deepEqual(details.proposal?.classifications, ["1a", "10a"]);
    assert.equal(details.proposal?.estimatedCost, "200000");
  });

  // Three columns hold a person's name. The firm's own certifier is
  // known by name, so the applicant and owner are the other two.
  test("tells the certifier apart from the applicant and the owner", () => {
    const details = preview().jobs[0].details;
    assert.equal(details.contact?.nameOrCompany, "Behram Aslam Chattha");
    assert.equal(details.owner?.name, "Behram Aslam Chattha");
    assert.notEqual(details.contact?.nameOrCompany, "Mohamad El Ghoul", "the certifier was taken for the applicant");
  });

  test("assembles the applicant's address from its separate columns", () => {
    const address = preview().jobs[0].details.applicantAddress;
    assert.deepEqual(address, { streetNumber: "27", street: "Mundamatta Street", suburb: "Villawood", state: "NSW", postcode: "2163" });
  });

  // The reference an export files a job under is the CDC's own
  // application case. The Portal closes that case on determination and
  // refuses inspections against it, so using it as the reporting case
  // would hand every imported job a number certain to be rejected.
  test("does not mistake the CDC's own case for the one inspections are reported against", () => {
    const job = preview().jobs[0];
    assert.equal(job.details.inspectionPortalCase, "");
    assert.equal(job.details.priorApproval?.portalRef, "CDC-26257", "but it is kept as the original certificate's case");
    assert.ok(
      job.warnings.some((w) => /portal case for reporting inspections/i.test(w)),
      "and the gap is named rather than left to be discovered at the first inspection"
    );
  });

  // A real heading row must still win: inference is the fallback, not
  // the preference.
  test("a heading row is still read as headings", () => {
    const withHeadings = ["Site Address\tCouncil", "1 Test St\tLiverpool"].join("\n");
    const paste = parsePaste(withHeadings, looksLikeHeadings)!;
    assert.deepEqual(paste.headers, ["Site Address", "Council"]);
    assert.equal(buildPreview(paste).inferred, false);
  });
});

// The headings BCS actually exports, verbatim. Two of them broke the
// reading the first time it met them, which is why they are held here.
describe("the export headings BCS actually produces", () => {
  const headers = [
    "Building Classification",
    "Lot Number",
    "Deposited Plan Number",
    "Consent Authority Name",
    "Cost of Project",
    "Applicant Name",
    "Owner Name",
    "Principal Contractor Name",
    "Street Number",
    "Street",
    "Suburb",
    "State",
    "Postcode",
  ];
  const row = ["1a, 10a", "766", "DP36608", "Canterbury-Bankstown Council", "$200,000.00", "Behram Aslam Chattha", "Behram Aslam Chattha", "ABC Builders Pty Ltd", "27", "Mundamatta Street", "Villawood", "NSW", "2163"];
  const job = () => buildPreview(parsePaste([headers.join("\t"), row.join("\t")].join("\n"), looksLikeHeadings)!).jobs[0];

  // "Deposited Plan Number" contains the letters of "site" — inside
  // "depoSITEd" — and was read as the property address.
  test("does not read the deposited plan as the property address", () => {
    const matched = matchColumns(headers);
    assert.equal(matched.plan, 2);
    assert.notEqual(matched.address, 2);
  });

  test("recognises every heading in the export", () => {
    const matched = matchColumns(headers);
    const claimed = new Set(Object.values(matched));
    const unread = headers.filter((_, i) => !claimed.has(i));
    assert.deepEqual(unread, [], `these headings were not recognised: ${unread.join(", ")}`);
  });

  // This export carries no property address column at all, and a job
  // without an address cannot be imported.
  test("builds the address from the street and suburb columns, and says so", () => {
    assert.equal(job().address, "27 Mundamatta Street, Villawood");
    assert.ok(job().warnings.some((w) => /built from the street and suburb columns/i.test(w)));
  });

  test("carries the lot, plan, cost and builder", () => {
    const details = job().details;
    assert.equal(details.certificateDetails?.lotSectionDp, "766 / DP36608");
    assert.equal(details.proposal?.estimatedCost, "200000");
    assert.equal(details.principalContractor, "ABC Builders Pty Ltd");
    assert.equal(details.council?.lga, "Canterbury-Bankstown Council");
  });

  // Nothing in this export is the open case inspections file against, so
  // the gap has to be named rather than guessed at.
  test("names the missing Portal case rather than inventing one", () => {
    assert.equal(job().details.inspectionPortalCase, "");
    assert.ok(job().warnings.some((w) => /portal case for reporting inspections/i.test(w)));
  });
});
