import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { extractLotDps } from "@/lib/nsw/propertyLookup";
import { lookupNswProperty, suggestNswAddresses, type Attempt } from "@/lib/nsw/spatial";
import { matchCouncilByAddress } from "@/lib/constants";
import { lookupPlanningLayers, formatArea } from "@/lib/nsw/planning";

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
  // The planning layers are only worth asking for when the certifier
  // asked for them: they are four more requests, and typing an address
  // should not fire them on every pause.
  const wantPlanning = debug || request.nextUrl.searchParams.get("planning") === "1";
  const askNsw = debug || wantPlanning || !fromText.length || !council;
  const remote = askNsw ? await lookupNswProperty(address, log) : { lots: [], lga: undefined, lotAreaSqm: null, point: null };

  // Zone, heritage and bushfire, asked at the point the parcel lookup
  // resolved. Nothing found is left null and typed in by hand — these
  // end up on a statutory certificate, so a blank is honest where a
  // guess would not be.
  const layers = wantPlanning && remote.point ? await lookupPlanningLayers(remote.point.lon, remote.point.lat, log) : null;

  const body: Record<string, unknown> = {
    lots: fromText.length ? fromText : remote.lots,
    lga: council?.name || remote.lga || null,
  };

  if (wantPlanning) {
    body.planning = {
      zone: layers?.zone || null,
      heritage: layers?.heritage || null,
      bushfire: layers?.bushfire || null,
      lotAreaSqm: remote.lotAreaSqm ?? null,
      lotArea: formatArea(remote.lotAreaSqm ?? null) || null,
      // What was actually reachable, so the panel can say "couldn't be
      // reached" rather than "not affected" — the difference between the
      // two matters on a certificate.
      reached: layers !== null,
    };
  }

  if (debug) {
    body.diagnostics = {
      address,
      lotsFoundInAddressText: fromText,
      councilFromDirectory: council?.name || null,
      lotsFromNsw: remote.lots,
      lgaFromNsw: remote.lga || null,
      pointFromNsw: remote.point || null,
      lotAreaSqmFromNsw: remote.lotAreaSqm ?? null,
      planningLayers: layers,
      addressSuggestions: await suggestNswAddresses(address, 8, log),
      calls: log,
    };
  }

  return NextResponse.json(body);
}
