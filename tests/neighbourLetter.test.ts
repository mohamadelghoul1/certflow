import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNeighbourLetterDocx } from "@/lib/docx/neighbourLetters";
import { readDocx } from "./helpers/readDocuments";
import { epiForCodeParts, SEPP_CODES_2008_NAME, SEPP_HOUSING_2021_NAME } from "@/lib/constants";
import type { Firm, Certifier } from "@/types/db";

const firm = { name: "Quality Private Certifiers", abn: "41 630 945 416", postal_address: "PO BOX 195", office_address: "Yagoona NSW 2199", phone: "02 8772 4022", email: "info@example.com", website: "www.example.com" } as unknown as Firm;
const certifier = { name: "Mohamad El Ghoul", registration_no: "BDC2961" } as unknown as Certifier;

async function letter(relevantInstrument: string, relevantPartOfCode: string) {
  const buffer = await buildNeighbourLetterDocx(
    {
      firm,
      certifier,
      jobAddress: "16 Wilkins Street, Yagoona",
      description: "Demolition of existing dwelling and construction of a two storey dwelling",
      applicantName: "Anh Cao",
      applicantPhone: "0400000000",
      applicantEmail: "applicant@example.com",
      applicantAddress: "16 Wilkins Street, Yagoona",
      relevantInstrument,
      relevantPartOfCode,
      projRef: "CDC-26001",
      issuedDate: "13 Jan 2026",
    },
    { logo: null, signature: null }
  );
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
