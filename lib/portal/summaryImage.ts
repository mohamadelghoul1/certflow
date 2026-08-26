import sharp from "sharp";

// The Portal refuses to record a visit without at least one "Inspection
// images" document. An inspection without photos is common — not every
// stage needs them — so CertFlow generates one: a clean card stating
// what the inspection was and how it ended, pointing at the signed
// report for the detail. Real information in image form, made so the
// certifier never has to hunt for a file just to satisfy a field.

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function buildInspectionSummaryImage(input: {
  firmName: string;
  address: string;
  inspectionTitle: string;
  date: string;
  outcomeText: string;
  inspectorName: string;
}): Promise<Uint8Array> {
  const e = escapeXml;
  const svg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="800" fill="#ffffff"/>
  <rect x="0" y="0" width="1200" height="8" fill="#1c3d5a"/>
  <text x="80" y="120" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#64748b">${e(input.firmName)}</text>
  <text x="80" y="200" font-family="Helvetica, Arial, sans-serif" font-size="52" font-weight="bold" fill="#0f172a">Inspection record</text>
  <text x="80" y="300" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#334155">${e(input.inspectionTitle)}</text>
  <text x="80" y="360" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#64748b">${e(input.address)}</text>
  <text x="80" y="460" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#334155">Date of inspection: ${e(input.date)}</text>
  <text x="80" y="515" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#334155">Carried out by: ${e(input.inspectorName)}</text>
  <text x="80" y="570" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#334155">Result: ${e(input.outcomeText)}</text>
  <text x="80" y="690" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#64748b">No site photographs were taken for this inspection.</text>
  <text x="80" y="730" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#64748b">Refer to the attached signed inspection report for the full record.</text>
</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Uint8Array(png);
}
