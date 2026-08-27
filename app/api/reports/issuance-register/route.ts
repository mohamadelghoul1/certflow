import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getIssuanceRegister, registerCsv, financialYearStart } from "@/lib/issuanceRegister";
import { todayISO } from "@/lib/business";

// The register as a spreadsheet — what an insurer's "please provide a
// list of certificates issued between…" actually wants attached.
export async function GET(request: NextRequest) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const from = request.nextUrl.searchParams.get("from") || financialYearStart(todayISO());
  const to = request.nextUrl.searchParams.get("to") || todayISO();
  const rows = await getIssuanceRegister(supabase, profile.firm_id, from, to);

  // The byte-order mark is what makes Excel read the file as UTF-8 —
  // without it, a client name with an accent arrives mangled.
  return new NextResponse(`﻿${registerCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="issuance-register-${from}-to-${to}.csv"`,
    },
  });
}
