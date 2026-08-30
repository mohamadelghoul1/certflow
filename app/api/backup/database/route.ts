import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { exportFirmDatabase, exportFileName, exportSummary } from "@/lib/backup/database";

// A copy of the firm's record, downloaded on the spot.
//
// The nightly copy to Dropbox is the one that matters, because it
// happens whether anyone remembers or not. This exists for the day
// somebody wants a copy in their own hands — before a migration, before
// handing the business over, or simply to see what a backup contains.
//
// Read through the certifier's own session, so the database decides
// whose records these are rather than this route being trusted to ask
// for the right firm.
export async function GET() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const exported = await exportFirmDatabase(supabase, profile.firm_id);
  if ("error" in exported) return NextResponse.json({ error: exported.error }, { status: 400 });

  const { rows, tables } = exportSummary(exported);
  return new NextResponse(JSON.stringify(exported, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(exported)}"`,
      // Counted in the headers as well as the file, so a backup that has
      // quietly become empty can be spotted without opening it.
      "X-Certlyn-Rows": String(rows),
      "X-Certlyn-Tables": String(tables),
      "Cache-Control": "no-store",
    },
  });
}
