import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { templateWorkbook, TEMPLATE_FILE_NAME } from "@/lib/import/template";

// The blank spreadsheet to fill in and drop on the Import page. Built
// fresh each time so it can never drift from the headings the import
// reads.
export async function GET() {
  await requireProfile("certifier");
  const bytes = templateWorkbook();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${TEMPLATE_FILE_NAME}"`,
      "Cache-Control": "no-store",
    },
  });
}
