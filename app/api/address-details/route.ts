import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { lookupNswProperty } from "@/lib/nsw/propertyLookup";
import { extractLotDpFromAddress, matchCouncilByAddress } from "@/lib/constants";

// Lot/DP and council for an address the certifier has just picked or
// typed. Answers from three sources in order of confidence: the address
// text itself (if it already says "Lot 12 DP123456"), the built-in
// suburb-to-council directory, and the NSW ePlanning Spatial API.
//
// Never an error: anything it can't work out simply comes back absent, and
// the form's own fields stay hand-editable.
export async function GET(request: NextRequest) {
  await requireProfile("certifier");

  const address = request.nextUrl.searchParams.get("address")?.trim() || "";
  if (address.length < 6) return NextResponse.json({});

  const fromText = extractLotDpFromAddress(address);
  const council = matchCouncilByAddress(address);

  // Only ask NSW for what we couldn't work out locally.
  const remote = fromText && council ? {} : await lookupNswProperty(address);

  return NextResponse.json({
    lotSectionDp: fromText || remote.lotSectionDp,
    lga: council?.name || remote.lga,
  });
}
