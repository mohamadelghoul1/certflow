import { Layout, INSPECTION_HEADER_FILL } from "@/lib/pdf/layout";
import type { PreInspectionData } from "@/lib/certificates/preInspectionData";
import { letterheadHeader, projectFooter, type PackageImages } from "@/lib/pdf/letterhead";

// The pre-inspection report as PDF, mirroring lib/docx/preInspectionReport.ts
// field for field.
//
// Two entry points because the report has two homes. Inside the approved
// set it is drawn straight into the certificate package's own Layout, so
// it flows on under the certificate on the same letterhead. When the
// approval is a signed PDF the certifier uploaded, there is no such
// Layout to draw into, so the report is built on its own and appended to
// the set behind that upload instead.

// The label column the certificate's own INSPECTION DETAILS block uses.
// These labels are full sentences rather than the certificate's one-word
// "Applicant:", so they need the room.
const LABEL_FRACTION = 0.38;

export function drawPreInspectionReport(l: Layout, data: PreInspectionData) {
  const labelWidth = l.contentWidth * LABEL_FRACTION;
  const row = (label: string, value: string) => l.fieldRow(label, value, labelWidth);

  l.pageBreak();
  l.documentTitle(data.title, { subtitle: data.address });

  l.heading("APPLICANT DETAILS", { rule: true });
  row("Applicant:", data.applicantName);
  row("Address:", data.applicantAddress);
  row("Phone:", data.applicantPhone);

  l.heading(data.isCdc ? "COMPLYING DEVELOPMENT CONSENTS" : "RELEVANT CONSENTS", { rule: true });
  row("Local Government Area:", data.lga);
  // A CC is issued against a development application; a CDC has no
  // equivalent, so the row is left out rather than printed empty.
  if (!data.isCdc) row("Development Applications (if applicable)", data.developmentConsentNumber);
  row(data.certificateLabel, data.ref);
  row("Application Date", data.applicationDate);

  l.heading("PROPOSAL", { rule: true });
  row("Address of Development:", data.address);
  row("Lot / DP:", data.lotSectionDp);
  row("Land Use Zoning:", data.zoning);
  row("Scope of Building Works Covered by this Notice:", data.scopeOfWorks);

  l.heading("INSPECTION DETAILS", { rule: true });
  row("Inspector:", data.inspectorName);
  row("Inspection date:", data.inspectionDate);
  row("Registration No.:", data.registrationNo);

  l.heading("INSPECTION RESULTS", { rule: true });
  l.text(
    "We have attended the above property and completed an inspection. The areas inspected and the overall outcome of the inspection are listed below, together with any specific defects noted or documents required.",
    { justify: true }
  );
  l.gap(4);
  l.table(
    ["Inspection Area", "Inspection Outcome"],
    data.rows.map((r) => [r.area, r.outcome]),
    [72, 28],
    { headerFill: INSPECTION_HEADER_FILL, zebra: true }
  );
}

// The signature and name that close the report. Separate from the body
// because embedding an image is async, and because inside the package the
// signature is already embedded for the certificate.
export async function signPreInspectionReport(l: Layout, data: PreInspectionData, signature: PackageImages["signature"]) {
  // The whole block moves to the next page rather than stranding the
  // heading on its own — the same reservation the certificate's
  // REGISTERED CERTIFIER block makes.
  l.ensure(76);
  l.heading("SIGNED BY:", { rule: true, gapBefore: 6 });
  if (signature) await l.image(signature.bytes, signature.type, 42);
  else l.gap(34);
  l.signatory(`${data.inspectorName || "—"} – Inspector`);
}

export async function buildPreInspectionReportPdf(data: PreInspectionData, images: PackageImages): Promise<Uint8Array> {
  const l = await Layout.create();
  const logo = images.logo ? await (images.logo.type === "png" ? l.doc.embedPng(images.logo.bytes) : l.doc.embedJpg(images.logo.bytes)) : null;
  l.header = letterheadHeader(data.firm, logo);
  l.footer = projectFooter(data.projRef, data.firm?.website);

  drawPreInspectionReport(l, data);
  await signPreInspectionReport(l, data, images.signature);

  return l.save();
}
