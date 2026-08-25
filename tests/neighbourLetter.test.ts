import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNeighbourLetterDocx } from "@/lib/docx/neighbourLetters";
import { buildNeighbourLetterPdf } from "@/lib/pdf/neighbourLetter";
import { readDocx, readPdf } from "./helpers/readDocuments";
import { epiForCodeParts, SEPP_CODES_2008_NAME, SEPP_HOUSING_2021_NAME } from "@/lib/constants";
import { neighbourLetterFixture } from "./helpers/fixture";

async function letter(relevantInstrument: string, relevantPartOfCode: string) {
  const buffer = await buildNeighbourLetterDocx(neighbourLetterFixture(relevantInstrument, relevantPartOfCode), { logo: null, signature: null });
  return (await readDocx(buffer)).text;
}

// The letter told neighbours the application was assessed under
// legislation that had nothing to do with it, because the bullet was
// copied from the template's own example and left as fixed text.
test("the letter cites the instrument the job is actually assessed under", async () => {
  const housing = ["Schedule One Complying Development Secondary Dwelling"];
  const text = await letter(epiForCodeParts(housing), housing.join(", "));
  assert.ok(text.includes(SEPP_HOUSING_2021_NAME));
  assert.ok(text.includes("Schedule One Complying Development Secondary Dwelling"));
  assert.ok(!text.includes(SEPP_CODES_2008_NAME), "the 2008 Codes SEPP has nothing to do with this job");
});

test("a Codes SEPP job cites the Codes SEPP and its part", async () => {
  const text = await letter(epiForCodeParts(["Part 3"]), "Part 3");
  assert.ok(text.includes(SEPP_CODES_2008_NAME));
  assert.ok(text.includes("Part 3"));
});

test("a job with no instrument recorded still reads as a complete list", async () => {
  const text = await letter("", "");
  assert.ok(text.includes(SEPP_CODES_2008_NAME), "falls back rather than leaving a gap mid-list");
  assert.ok(text.includes("The Building Code of Australia."));
});

test("the notice carries the applicant's details for neighbours to use", async () => {
  const text = await letter(SEPP_HOUSING_2021_NAME, "");
  assert.ok(text.includes("Section 134"));
  assert.ok(text.includes("Dear Occupant"));
  assert.ok(text.includes("Anh Cao"));
  assert.ok(text.includes("applicant@example.com"));
  assert.ok(text.includes("16 Wilkins Street, Yagoona"));
  assert.ok(text.includes("no sooner than 14 days"));
});

// The PDF is the same letter as the Word file, for printing rather than
// editing — so the two have to say the same thing about the same job.
async function letterPdf(relevantInstrument: string, relevantPartOfCode: string) {
  const bytes = await buildNeighbourLetterPdf(neighbourLetterFixture(relevantInstrument, relevantPartOfCode), { logo: null, signature: null });
  const { pages, text } = await readPdf(bytes);
  return { pages, text: text.replace(/\s+/g, " ") };
}

test("the PDF cites the same instrument the Word letter does", async () => {
  const housing = ["Schedule One Complying Development Secondary Dwelling"];
  const { text } = await letterPdf(epiForCodeParts(housing), housing.join(", "));
  assert.ok(text.includes(SEPP_HOUSING_2021_NAME));
  assert.ok(text.includes("Schedule One Complying Development Secondary Dwelling"));
  assert.ok(!text.includes(SEPP_CODES_2008_NAME), "the 2008 Codes SEPP has nothing to do with this job");
});

test("the PDF falls back to the Codes SEPP when the job records no instrument", async () => {
  const { text } = await letterPdf("", "");
  assert.ok(text.includes(SEPP_CODES_2008_NAME), "a bullet in a legislative list is never left blank");
});

test("the PDF is one page, addressed to the occupant and signed", async () => {
  const { pages, text } = await letterPdf(SEPP_CODES_2008_NAME, "Part 3 Housing Code");
  assert.equal(pages.length, 1, "one letter per letterbox — it has to print as a single sheet");
  assert.ok(text.includes("Dear Occupant,"));
  assert.ok(!text.includes("Anh Cao,\n"), "there is no recipient block, only the applicant's details further down");
  assert.ok(text.includes("Full name: Anh Cao"));
  assert.ok(text.includes("Phone: 0400000000"));
  assert.ok(text.includes("applicant@example.com"));
  assert.ok(text.includes("Mohamad El Ghoul"));
  assert.ok(text.includes("Registered Certifier"));
  // Letterhead and footer, the same ones every other document carries.
  assert.ok(text.includes("ABN: 41 630 945 416"));
  assert.ok(text.includes("Project No.: CDC-26001"));
});
