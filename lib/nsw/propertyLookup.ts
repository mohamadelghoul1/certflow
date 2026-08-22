// Lot/DP and council LGA for a NSW address, from the NSW ePlanning
// Spatial API (api.apps1.nsw.gov.au) — a public, keyless service run by
// the Department of Planning, the same one behind the NSW Planning
// Portal's own address search.
//
// Everything here is written to fail soft. A lookup that times out,
// returns an unexpected shape, or simply doesn't know the address gives
// back an empty result, and the certifier types the Lot/DP and council in
// by hand exactly as before — this only ever saves keystrokes, it is
// never the only way to fill those fields in.
//
// Because the responses are parsed by scanning for the values we want
// rather than by walking a fixed path, a change to the service's field
// names degrades to "no suggestion" instead of a crash.

const BASE = "https://api.apps1.nsw.gov.au/eplanning/data/v0";
const TIMEOUT_MS = 4000;

export type PropertyLookup = { lotSectionDp?: string; lga?: string };

async function getJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Walks any JSON value and hands every key/value pair to the visitor, so
// a value can be found without knowing where in the response it lives.
function walk(value: unknown, visit: (key: string, value: unknown) => void, depth = 0) {
  if (depth > 6 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const entry of value) walk(entry, visit, depth + 1);
    return;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    visit(key, entry);
    walk(entry, visit, depth + 1);
  }
}

function findByKey(payload: unknown, pattern: RegExp): string | undefined {
  let found: string | undefined;
  walk(payload, (key, value) => {
    if (found !== undefined) return;
    if (!pattern.test(key)) return;
    if (typeof value === "string" && value.trim()) found = value.trim();
    else if (typeof value === "number") found = String(value);
  });
  return found;
}

// Lot/DP comes back in several spellings depending on the endpoint —
// "12//DP123456", "12/3/DP123456", "LOT 12 DP 123456" — all of which mean
// the same parcel. Normalised to the "Lot / Section / DP" field's own
// format, with "-" standing in for an absent section.
const SLASHED = /\b(\d+[A-Z]?)\s*\/\s*([0-9A-Z]*|-)\s*\/\s*(DP|SP)\s*(\d+)\b/i;
const WORDED = /\bLOT\s*(\d+[A-Z]?)\s*(?:,?\s*SEC(?:TION)?\s*([0-9A-Z]+))?\s*,?\s*(?:IN\s*)?(DP|SP)\s*(\d+)\b/i;

export function normalizeLotDp(text: string): string | undefined {
  const match = text.match(SLASHED) || text.match(WORDED);
  if (!match) return undefined;
  const [, lot, section, plan, planNo] = match;
  const sec = section && section !== "-" ? section : "-";
  return `${lot}/${sec}/${plan.toUpperCase()}${planNo}`;
}

function findLotDp(payload: unknown): string | undefined {
  let found: string | undefined;
  walk(payload, (_key, value) => {
    if (found !== undefined || typeof value !== "string") return;
    found = normalizeLotDp(value);
  });
  return found;
}

// The property id the follow-up lookups are keyed on — named propId in
// the address search's own response.
function findPropId(payload: unknown): string | undefined {
  return findByKey(payload, /^prop(erty)?_?id$/i);
}

export async function lookupNswProperty(address: string): Promise<PropertyLookup> {
  const query = address.trim();
  if (query.length < 6) return {};

  const search = await getJson(`${BASE}/FetchAddress?a=${encodeURIComponent(query)}&noOfRecords=1`);
  if (!search) return {};

  const result: PropertyLookup = {};
  // Some address records already carry the parcel description, in which
  // case there's nothing further to ask for.
  result.lotSectionDp = findLotDp(search);

  const propId = findPropId(search);
  if (!propId) return result;

  const [lots, lga] = await Promise.all([
    result.lotSectionDp ? Promise.resolve(null) : getJson(`${BASE}/FetchLotsFromProperty?propId=${encodeURIComponent(propId)}`),
    getJson(`${BASE}/FetchLGAName?id=${encodeURIComponent(propId)}&Type=property`),
  ]);

  if (!result.lotSectionDp && lots) result.lotSectionDp = findLotDp(lots);
  if (lga) result.lga = findByKey(lga, /lga|council|name/i);

  return result;
}
