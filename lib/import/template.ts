import * as XLSX from "xlsx";
import type { JobField } from "@/lib/import/jobColumns";

// The spreadsheet Certlyn hands out to be filled in.
//
// Reading any system's export is the hard way round, and it is kept
// because some firms only have that. But a firm starting from nothing —
// or from a system whose export nobody can find — wants to be told what
// to type, in what column, with an example. So this is a blank book
// with Certlyn's own headings on the first sheet, and a second sheet
// that explains every column in plain words.
//
// The headings here are exactly the names the column matcher knows, and
// a test holds them to that: a template that Certlyn itself could not
// read would be a cruel joke.

export type TemplateColumn = { field: JobField; heading: string; guidance: string; example: string };

export const TEMPLATE_COLUMNS: TemplateColumn[] = [
  { field: "address", heading: "Property address", guidance: "The site the work is on. The one column that must be filled in — a row without it is skipped.", example: "12 Example Street, Liverpool NSW 2170" },
  { field: "description", heading: "Scope of works", guidance: "What is being built, in a line.", example: "New two-storey dwelling with attached garage" },
  { field: "projectNumber", heading: "Project number", guidance: "Your own job or file number, if you use one. Leave blank and Certlyn numbers it.", example: "QP-2026-041" },
  { field: "lotSectionDp", heading: "Lot / Section / Plan", guidance: "The lot and plan as on the title. Can be looked up from the address later if you leave it blank.", example: "Lot 12 DP 123456" },
  { field: "lga", heading: "Council", guidance: "The local council.", example: "Liverpool City Council" },
  { field: "approvalType", heading: "Approval type", guidance: "CDC or CC — whichever certificate the previous certifier issued.", example: "CDC" },
  { field: "approvalNumber", heading: "Approval number", guidance: "The CDC or CC number on that certificate.", example: "CDC-2025/0412" },
  { field: "approvalDate", heading: "Approval date", guidance: "The date that certificate was issued. Any date format is fine.", example: "14/03/2025" },
  { field: "approvalIssuedBy", heading: "Approval issued by", guidance: "The certifier or council that issued it.", example: "ABC Certifiers Pty Ltd" },
  { field: "portalCase", heading: "Portal case", guidance: "The NSW Planning Portal case the inspections are reported against (CFT or PCA number), if you have it.", example: "CFT-123456" },
  { field: "applicantName", heading: "Applicant", guidance: "The person or company you deal with on this job. Becomes the client who gets portal access.", example: "Jane Citizen" },
  { field: "applicantEmail", heading: "Applicant email", guidance: "Where their portal invitation and updates go.", example: "jane@example.com" },
  { field: "applicantPhone", heading: "Applicant phone", guidance: "", example: "0400 000 000" },
  { field: "applicantAddress", heading: "Applicant address", guidance: "Their postal address, on one line. Leave blank if it is the site.", example: "5 Other Road, Casula NSW 2170" },
  { field: "ownerName", heading: "Owner", guidance: "The land owner, if different from the applicant.", example: "J & P Citizen" },
  { field: "principalContractor", heading: "Principal contractor", guidance: "The builder carrying out the work.", example: "Buildwell Homes Pty Ltd" },
  { field: "classification", heading: "BCA classification", guidance: "The building class or classes.", example: "1a, 10a" },
  { field: "zoning", heading: "Zoning", guidance: "The land zone, if known.", example: "R2" },
  { field: "estimatedCost", heading: "Estimated cost", guidance: "The value of the works, if known.", example: "450000" },
  { field: "certifierName", heading: "Certifier name", guidance: "Which of your certifiers holds this job, by name as it appears in Certlyn. Blank means the one chosen on the import page.", example: "Mohamad El Ghoul" },
];

export const TEMPLATE_FILE_NAME = "certlyn-projects-template.xlsx";

const GUIDE_INTRO = [
  ["How to fill this in"],
  [""],
  ["Fill in the Projects sheet, one row per project, under the headings already there. Do not rename the headings."],
  ["Only Property address is essential. Everything else can be left blank and added to the project in Certlyn later."],
  ["When it is done, save the file and drop it onto the Import page. Certlyn shows what it read before anything is imported."],
  [""],
  ["Column", "What to put in it", "Example"],
];

export function templateWorkbook(): Uint8Array {
  const book = XLSX.utils.book_new();

  const projects = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS.map((c) => c.heading)]);
  projects["!cols"] = TEMPLATE_COLUMNS.map((c) => ({ wch: Math.max(18, c.heading.length + 4) }));
  XLSX.utils.book_append_sheet(book, projects, "Projects");

  const guide = XLSX.utils.aoa_to_sheet([...GUIDE_INTRO, ...TEMPLATE_COLUMNS.map((c) => [c.heading, c.guidance, c.example])]);
  guide["!cols"] = [{ wch: 24 }, { wch: 96 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(book, guide, "How to fill this in");

  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}
