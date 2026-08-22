import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { extractLotDps } from "@/lib/nsw/propertyLookup";
import { lookupNswProperty, suggestNswAddresses, type Attempt } from "@/lib/nsw/spatial";
import { matchCouncilByAddress } from "@/lib/constants";

// Lot/Section/Plan and council for an address the certifier has picked or
// typed. Answers from three sources: the address text itself (if it
// already says "Lot 12 DP123456"), the built-in suburb-to-council
// directory, and the NSW ePlanning Spatial API.
//
// A property can sit across more than one parcel, so lots come back as a
// list for the certifier to tick — the same way the NSW Planning Portal
// presents them.
//
// Never an error: anything it can't work out simply comes back empty, and
// the form's own fields stay hand-editable.
//
// Adding &debug=1 returns every NSW call that was made with its status
// and response. The NSW service can't be reached from the environment
// this app is developed in, so that output is the only way to tell a
// wrong endpoint from a blocked request from an address NSW genuinely
// doesn't hold.
export async function GET(request: NextRequest) {
  await requireProfile("certifier");

  const address = request.nextUrl.searchParams.get("address")?.trim() || "";
  const debug = request.nextUrl.searchParams.get("debug") === "1";

  if (address.length < 6) return NextResponse.json({ lots: [] });

  const fromText = extractLotDps(address);
  const council = matchCouncilByAddress(address);
  const log: Attempt[] = [];

  // Only ask NSW for what we couldn't work out locally — unless we're
  // diagnosing, in which case ask regardless so there's something to see.
  const askNsw = debug || !fromText.length || !council;
  const remote = askNsw ? await lookupNswProperty(address, log) : { lots: [], lga: undefined };

  const body: Record<string, unknown> = {
    lots: fromText.length ? fromText : remote.lots,
    lga: council?.name || remote.lga || null,
  };

  if (debug) {
    body.diagnostics = {
      address,
      lotsFoundInAddressText: fromText,
      councilFromDirectory: council?.name || null,
      lotsFromNsw: remote.lots,
      lgaFromNsw: remote.lga || null,
      addressSuggestions: await suggestNswAddresses(address, 8, log),
      calls: log,
    };
  }

  return NextResponse.json(body);
}
