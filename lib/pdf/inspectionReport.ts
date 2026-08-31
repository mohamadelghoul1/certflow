import { Layout, INSPECTION_HEADER_FILL, MARGIN, SMALL_SIZE, MUTED, LINE } from "@/lib/pdf/layout";
import { letterheadHeader, projectFooter, type PackageImages } from "@/lib/pdf/letterhead";
import { formatAddress } from "@/lib/certificates/pathwayData";
import { INSPECTION_OUTCOME_TEXT, INSPECTION_REINSPECTION_TEXT } from "@/lib/constants";
import { formatISODate } from "@/lib/business";
import type { InspectionReportData } from "@/lib/certificates/inspectionReportData";

// The inspection report as a PDF, mirroring the screen page and the Word
// export section for section.
//
// It exists so the report can simply be downloaded. Until now the only
// way to get a PDF of it was the browser's print dialog, which means
// margins, headers and page breaks decided by whatever browser and
// printer driver the certifier happens to have, rather than by Certlyn.

const LABEL_FRACTION = 0.38;


export type ReportPhoto = { image: PackageImages["signature"]; caption: string };

export async function buildInspectionReportPdf(
  data: InspectionReportData,
  images: PackageImages & { photos: ReportPhoto[] }
): Promise<Uint8Array> {
  const { job, firm, inspection, inspector, d, applicantName, certRef, certNumbers, titleRefs, certTypeLabel, consentRefLines, introText, notes } = data;

  const l = await Layout.create();
  const logo = images.logo ? await (images.logo.type === "png" ? l.doc.embedPng(images.logo.bytes) : l.doc.embedJpg(images.logo.bytes)) : null;
  l.header = letterheadHeader(firm, logo);
  l.footer = projectFooter(certRef, firm?.website);

  const labelWidth = l.contentWidth * LABEL_FRACTION;
  // Skips the row entirely rather than printing an empty one: the report
  // is a record of what is actually on file, unlike a certificate, which
  // shows every field because it is a fixed legal form.
  const row = (label: string, value?: string | null) => {
    if (value) l.fieldRow(label, value, labelWidth);
  };

  l.newPage();
  l.documentTitle(`INSPECTION REPORT – ${titleRefs} – ${inspection.title}`, { subtitle: job.address || "" });

  l.heading("APPLICANT DETAILS", { rule: true });
  row("Applicant:", applicantName);
  row("Address:", formatAddress(d.applicantAddress));
  row("Phone:", d.contact?.phone || d.contact?.mobile);
  row("Email:", d.contact?.email);

  l.heading("RELEVANT CONSENTS", { rule: true });
  row("Local Government Area:", d.council?.lga);
  if (consentRefLines.length) row("Development Applications (if applicable):", consentRefLines.join(", "));
  row(`${certTypeLabel} Number`, certNumbers);

  l.heading("PROPOSAL", { rule: true });
  row("Address of Development:", job.address);
  row("Lot / DP:", d.certificateDetails?.lotSectionDp);
  row("Land Use Zoning:", d.zoning);
  row("Scope of Building Works Covered by this Notice:", job.description);

  l.heading("INSPECTION DETAILS", { rule: true });
  row("Inspector:", inspector?.name);
  // Absent rather than "Not yet scheduled" when no date has been recorded.
  row("Inspection date:", inspection.date ? formatISODate(inspection.date) : null);
  row("Registration No.:", inspector?.registration_no);

  l.heading("INSPECTION RESULTS", { rule: true });
  l.text(introText, { justify: true });
  l.gap(4);
  l.table(
    ["Inspection Area", "Inspection Outcome", "Reinspections"],
    [[`1. ${inspection.title}`, INSPECTION_OUTCOME_TEXT[inspection.outcome], INSPECTION_REINSPECTION_TEXT[inspection.outcome]]],
    [34, 36, 30],
    { headerFill: INSPECTION_HEADER_FILL, zebra: true }
  );

  l.heading("REQUIRED DOCUMENTS", { rule: true });
  // Listed as found on the day. Nothing here is marked resolved: whether
  // an issue was rectified is what the next inspection records.
  if (inspection.defects.length === 0) l.text("No further documents are required.");
  else inspection.defects.forEach((defect, i) => l.text(`${i + 1}. ${defect.text}`, { gapAfter: 2 }));

  if (notes) {
    l.heading("NOTES", { rule: true });
    l.text(notes, { justify: true });
  }

  // The signature and the name move together, so the report never ends
  // with a signature stranded on a page of its own.
  l.ensure(78);
  l.heading("SIGNED BY:", { rule: true, gapBefore: 6 });
  if (images.signature) await l.image(images.signature.bytes, images.signature.type, 42);
  else l.gap(34);
  l.signatory(`${inspector?.name || "—"} – Inspector`);

  const photos = images.photos.filter((p) => p.image);
  if (photos.length > 0) {
    l.pageBreak();
    l.documentTitle("PHOTOGRAPHIC EVIDENCE", { subtitle: `${inspection.title} – ${certRef}` });
    await drawPhotoGrid(l, photos);
  }

  return l.save();
}

// Two to a row, each sized to the same box so a mix of portrait and
// landscape shots still lines up, with the caption under it.
async function drawPhotoGrid(l: Layout, photos: ReportPhoto[]) {
  const gap = 12;
  const cellWidth = (l.contentWidth - gap) / 2;
  const cellHeight = cellWidth * 0.75;
  const captionLead = SMALL_SIZE * 1.4;

  for (let i = 0; i < photos.length; i += 2) {
    const pair = photos.slice(i, i + 2);
    const captionLines = pair.map((p, j) => l.wrap(`${i + j + 1}. ${p.caption}`.trim(), cellWidth, SMALL_SIZE));
    const rowHeight = cellHeight + 4 + Math.max(...captionLines.map((lines) => lines.length)) * captionLead + gap;

    l.ensure(rowHeight);
    const top = l.y;

    for (let j = 0; j < pair.length; j++) {
      const photo = pair[j];
      if (!photo.image) continue;
      const x = MARGIN + j * (cellWidth + gap);
      const embedded = photo.image.type === "png" ? await l.doc.embedPng(photo.image.bytes) : await l.doc.embedJpg(photo.image.bytes);
      // Contained rather than cropped: a photo of a defect is evidence,
      // and cropping it to fill a box can cut the defect out of frame.
      const scale = Math.min(cellWidth / embedded.width, cellHeight / embedded.height);
      const width = embedded.width * scale;
      const height = embedded.height * scale;
      l.page.drawRectangle({ x, y: top - cellHeight, width: cellWidth, height: cellHeight, borderColor: LINE, borderWidth: 0.5 });
      l.page.drawImage(embedded, { x: x + (cellWidth - width) / 2, y: top - cellHeight + (cellHeight - height) / 2, width, height });

      captionLines[j].forEach((line, k) => {
        l.page.drawText(line, { x, y: top - cellHeight - 4 - SMALL_SIZE - k * captionLead, size: SMALL_SIZE, font: l.regular, color: MUTED });
      });
    }

    l.y = top - rowHeight;
  }

  // Keeps the next thing drawn from starting above the page floor.
  if (l.y < 0) l.y = 0;
}
