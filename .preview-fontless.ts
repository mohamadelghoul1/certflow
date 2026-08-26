import { buildInspectionSummaryImage } from "@/lib/portal/summaryImage";
import { writeFileSync } from "node:fs";
async function main() {
  const bytes = await buildInspectionSummaryImage({
    firmName: "Quality Private Certifiers",
    address: "378 Scenic Drive San Remo",
    inspectionTitle: "Piers & Footings",
    date: "24 Aug 2026",
    outcomeText: "Satisfactory (minor issues) subject to documents/conditions being provided",
    inspectorName: "Mohamad El Ghoul",
  });
  writeFileSync(process.argv[2], Buffer.from(bytes));
  console.log("rendered", bytes.length, "bytes");
}
main();
