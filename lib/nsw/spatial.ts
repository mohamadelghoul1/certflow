// Address search and Lot/Section/Plan from NSW Spatial Services.
//
// This replaces an earlier attempt against the NSW ePlanning API, which
// returns 404 for every endpoint — that service is gone. NSW Spatial
// Services' ArcGIS REST API is live, public and needs no key, and its
// NSW_Land_Parcel_Property_Theme holds exactly what's wanted. The layer
// numbers and field names below were read off the running service rather
// than guessed:
//
//   layer 12 "Property" — address, housenumber, propid
//   layer  8 "Lot"      — lotidstring, lotnumber, sectionnumber, planlabel
//
// Lots are not linked to properties by a key, so the address is resolved
// to a property first and its lots found by asking which parcels the
// property sits on. That's two calls, which is why the typed-address
// lookup is debounced and the suggestions query asks for no geometry.
//
// Everything fails soft: any error, timeout or unexpected shape gives an
// empty result and the certifier types the details in by hand.

const PORTAL = "https://portal.spatial.nsw.gov.au/server/rest/services";
const PARCEL = `${PORTAL}/NSW_Land_Parcel_Property_Theme/MapServer`;
const PROPERTY_LAYER = 12;
const LOT_LAYER = 8;
const TIMEOUT_MS = 8000;

export type Attempt = { url: string; status: number | string; body?: string };

type Json = Record<string, unknown>;
type Feature = { attributes?: Json; geometry?: Json; centroid?: Json };

async function getJson(url: string, log?: Attempt[]): Promise<Json | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json, */*" } });
    const text = await res.text();
    log?.push({ url, status: res.status, body: text.slice(0, 600) });
    if (!res.ok) return null;
    return JSON.parse(text) as Json;
  } catch (e) {
    log?.push({ url, status: e instanceof Error ? e.name : "failed" });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Everything that isn't a letter, digit or space is stripped: this value
// is interpolated into an ArcGIS where clause, so leaving quotes or SQL
// punctuation in it would let a typed address change the query's meaning.
// NSW and the postcode go too — the address field holds neither.
function addressWords(input: string): string[] {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w !== "NSW" && !/^\d{4}$/.test(w));
}

// Matches on the start of the address only — "29 STRICKLAND%" — never
// with a leading wildcard.
//
// This matters more than it looks. The first attempt asked for
// UPPER(address) LIKE '%29%STRICKLAND%ROAD%GUILDFORD%', and every one of
// those queries timed out: a leading wildcard can't use an index, and
// wrapping the column in UPPER() disables it too, so the server was made
// to read every property in New South Wales. Anchoring at the start keeps
// the index in play and the query fast.
//
// Only the street number and street name go into it, because the rest of
// what someone types ("road", "guildford") may be worded differently or
// out of order in the stored address. The remaining words are matched in
// filterByWords below, against the much smaller set that comes back.
function addressWhere(words: string[]): string | null {
  const prefix = words.slice(0, 2);
  if (prefix.length === 0) return null;
  return `address LIKE '${prefix.join(" ")}%'`;
}

// The words the prefix didn't cover, matched against the candidates the
// server returned rather than by making the server do the work.
function filterByWords(addresses: string[], words: string[]): string[] {
  const rest = words.slice(2);
  if (rest.length === 0) return addresses;
  const matching = addresses.filter((a) => {
    const upper = a.toUpperCase();
    return rest.every((w) => upper.includes(w));
  });
  // A suburb spelt differently from the stored record shouldn't wipe out
  // an otherwise good match, so fall back to everything on the street.
  return matching.length ? matching : addresses;
}

function features(data: Json | null): Feature[] {
  const f = data?.features;
  return Array.isArray(f) ? (f as Feature[]) : [];
}

// A point inside the property, for asking which lots it sits on. The
// service is 10.91, so it can return a centroid itself; the ring average
// is a fallback for a response that doesn't include one.
function pointFor(feature: Feature): { x: number; y: number } | null {
  const c = feature.centroid as { x?: number; y?: number } | undefined;
  if (typeof c?.x === "number" && typeof c?.y === "number") return { x: c.x, y: c.y };

  const rings = (feature.geometry as { rings?: number[][][] } | undefined)?.rings;
  const ring = rings?.[0];
  if (!ring?.length) return null;
  const sum = ring.reduce((acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }), { x: 0, y: 0 });
  return { x: sum.x / ring.length, y: sum.y / ring.length };
}

// "1//DP123456" is how lotidstring comes back; the parts are used when
// that field is empty, which happens for some strata records.
function lotLabel(a: Json): string | null {
  const id = typeof a.lotidstring === "string" ? a.lotidstring.trim() : "";
  if (id) return id;
  const lot = a.lotnumber ? String(a.lotnumber).trim() : "";
  const plan = a.planlabel ? String(a.planlabel).trim() : "";
  if (!lot || !plan) return null;
  const section = a.sectionnumber ? String(a.sectionnumber).trim() : "";
  return `${lot}/${section || "-"}/${plan}`;
}

// Pulls a wider set than it shows: the server narrows by street, and the
// remaining words are matched here. returnDistinctValues is deliberately
// not used — it forces a sort over the whole match set, which is more
// work for the server than de-duplicating a couple of hundred strings.
async function addressCandidates(input: string, log?: Attempt[]): Promise<{ addresses: string[]; words: string[] }> {
  const words = addressWords(input.trim());
  const where = addressWhere(words);
  if (!where) return { addresses: [], words };

  const url = `${PARCEL}/${PROPERTY_LAYER}/query?where=${encodeURIComponent(where)}&outFields=address&returnGeometry=false&resultRecordCount=200&f=json`;
  const data = await getJson(url, log);

  const addresses = [
    ...new Set(
      features(data)
        .map((f) => (typeof f.attributes?.address === "string" ? f.attributes.address.trim() : ""))
        .filter(Boolean)
    ),
  ];
  return { addresses, words };
}

export async function suggestNswAddresses(input: string, limit = 8, log?: Attempt[]): Promise<string[]> {
  if (input.trim().length < 4) return [];
  const { addresses, words } = await addressCandidates(input, log);
  return filterByWords(addresses, words).slice(0, limit);
}

export type PropertyLookup = { lots: string[]; lga?: string };

export async function lookupNswProperty(address: string, log?: Attempt[]): Promise<PropertyLookup> {
  if (address.trim().length < 6) return { lots: [] };

  // Resolved to one exact address first, so the geometry request is for a
  // single known property rather than everything on the street.
  const { addresses, words } = await addressCandidates(address, log);
  const best = filterByWords(addresses, words)[0];
  if (!best) return { lots: [] };

  const exact = `address = '${best.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ")}'`;
  const propertyUrl = `${PARCEL}/${PROPERTY_LAYER}/query?where=${encodeURIComponent(exact)}&outFields=address,propid&returnGeometry=true&returnCentroid=true&resultRecordCount=1&f=json`;
  const propertyData = await getJson(propertyUrl, log);
  const property = features(propertyData)[0];
  if (!property) return { lots: [] };

  const point = pointFor(property);
  if (!point) return { lots: [] };

  // The spatial reference the geometry came back in, so the point is
  // interpreted in the same coordinates. It sits on the response rather
  // than on each feature. 102100 (Web Mercator) is this service's
  // default, per the metadata it reports.
  const wkid = (propertyData?.spatialReference as { wkid?: number } | undefined)?.wkid ?? 102100;

  const lotUrl =
    `${PARCEL}/${LOT_LAYER}/query?geometry=${encodeURIComponent(`${point.x},${point.y}`)}` +
    `&geometryType=esriGeometryPoint&inSR=${wkid}&spatialRel=esriSpatialRelIntersects` +
    `&outFields=lotidstring,lotnumber,sectionnumber,planlabel&returnGeometry=false&resultRecordCount=12&f=json`;

  const lots = features(await getJson(lotUrl, log))
    .map((f) => (f.attributes ? lotLabel(f.attributes) : null))
    .filter((l): l is string => !!l);

  return { lots: [...new Set(lots)] };
}
