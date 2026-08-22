// Address search, Lot/Section/Plan and council LGA from the NSW ePlanning
// Spatial API (api.apps1.nsw.gov.au) — the public, keyless service behind
// the NSW Planning Portal's own "Find a property" search.
//
// Using NSW for the address suggestions as well as the parcel details is
// deliberate: it needs no API key or billing account, and it only knows
// NSW addresses, which is the only kind this app deals with.
//
// Everything here fails soft. A lookup that times out, returns an
// unexpected shape, or simply doesn't know the address gives back an
// empty result, and the certifier types the details in by hand exactly as
// before. Responses are parsed by scanning for the values we want rather
// than by walking a fixed path, so a change to the service's field names
// degrades to "no suggestion" instead of an error.

const BASE = "https://api.apps1.nsw.gov.au/eplanning/data/v0";
const TIMEOUT_MS = 6000;

export type PropertyLookup = { lots: string[]; lga?: string };

// A record of every call made, so the diagnostic endpoint can show what
// NSW actually said. Without it there is no way to tell a wrong endpoint
// from a blocked request from an address NSW genuinely doesn't hold.
export type Attempt = { url: string; status: number | string; body?: string };

async function getJson(url: string, log?: Attempt[]): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Some government gateways reject requests with no browser-ish
      // headers outright, which looks identical to "no results" from the
      // outside.
      headers: { Accept: "application/json, text/plain, */*", "User-Agent": "CertFlow/1.0 (+certifier job management)" },
    });
    const text = await res.text();
    log?.push({ url, status: res.status, body: text.slice(0, 1200) });
    if (!res.ok) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch (e) {
    log?.push({ url, status: e instanceof Error ? e.name : "failed" });
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

// A lot identifier is not always a number. NSW parcels are routinely
// lettered ("A/-/DP370654" is a real Sutherland property), and can be a
// number with a letter suffix ("12A"), so anything alphanumeric counts.
// The plan number that follows is what makes the match unambiguous.
const LOT = "[0-9A-Z]{1,6}";
const SLASHED = new RegExp(`\\b(${LOT})\\s*/\\s*([0-9A-Z]*|-)\\s*/\\s*(DP|SP)\\s*(\\d+)\\b`, "gi");
const WORDED = new RegExp(`\\bLOT\\s*(${LOT})\\s*(?:,?\\s*SEC(?:TION)?\\s*([0-9A-Z]+))?\\s*,?\\s*(?:IN\\s*)?(DP|SP)\\s*(\\d+)\\b`, "gi");

function format(lot: string, section: string | undefined, plan: string, planNo: string) {
  const sec = section && section !== "-" ? section.toUpperCase() : "-";
  return `${lot.toUpperCase()}/${sec}/${plan.toUpperCase()}${planNo}`;
}

// Every Lot/Section/Plan in a piece of text, in the order they appear.
// A property can sit across several parcels, which is why the portal
// itself lists them and lets you tick the ones that apply.
export function extractLotDps(text: string): string[] {
  const out: string[] = [];
  for (const re of [SLASHED, WORDED]) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) out.push(format(m[1], m[2], m[3], m[4]));
  }
  return [...new Set(out)];
}

export function normalizeLotDp(text: string): string | undefined {
  return extractLotDps(text)[0];
}

function findLotDps(payload: unknown): string[] {
  const out: string[] = [];
  walk(payload, (_key, value) => {
    if (typeof value === "string") out.push(...extractLotDps(value));
  });
  return [...new Set(out)];
}

// The property id the follow-up lookups are keyed on — named propId in
// the address search's own response.
function findPropId(payload: unknown): string | undefined {
  return findByKey(payload, /^prop(erty)?_?id$/i);
}

function addressStrings(payload: unknown): string[] {
  const out: string[] = [];
  walk(payload, (key, value) => {
    if (/address/i.test(key) && typeof value === "string" && value.trim().length > 5) out.push(value.trim());
  });
  return [...new Set(out)];
}

// Matching NSW addresses for a partial one being typed.
export async function suggestNswAddresses(input: string, limit = 8, log?: Attempt[]): Promise<string[]> {
  const query = input.trim();
  if (query.length < 4) return [];
  const data = await getJson(`${BASE}/FetchAddress?a=${encodeURIComponent(query)}&noOfRecords=${limit}`, log);
  if (!data) return [];
  // The address search returns a plain array of strings on some
  // deployments and objects on others, so take both.
  const direct = Array.isArray(data) ? data.filter((v): v is string => typeof v === "string" && v.trim().length > 5) : [];
  return [...new Set([...direct, ...addressStrings(data)])].slice(0, limit);
}

// The follow-up endpoints that carry parcel details, tried in order.
// Which one answers depends on the service; whichever returns something
// recognisable wins, and if none do the certifier types the lot in.
const LOT_ENDPOINTS = [(id: string) => `${BASE}/FetchLotsFromProperty?propId=${encodeURIComponent(id)}`, (id: string) => `${BASE}/FetchPropertyDetails?propId=${encodeURIComponent(id)}`];

export async function lookupNswProperty(address: string, log?: Attempt[]): Promise<PropertyLookup> {
  const query = address.trim();
  if (query.length < 6) return { lots: [] };

  const search = await getJson(`${BASE}/FetchAddress?a=${encodeURIComponent(query)}&noOfRecords=1`, log);
  if (!search) return { lots: [] };

  // Some address records already carry the parcel description, in which
  // case there's nothing further to ask for.
  let lots = findLotDps(search);
  let lga: string | undefined;

  const propId = findPropId(search);
  if (propId) {
    const lgaData = await getJson(`${BASE}/FetchLGAName?id=${encodeURIComponent(propId)}&Type=property`, log);
    if (lgaData) lga = findByKey(lgaData, /lga|council|name/i);

    for (const endpoint of LOT_ENDPOINTS) {
      if (lots.length) break;
      const data = await getJson(endpoint(propId), log);
      if (data) lots = findLotDps(data);
    }
  }

  return { lots, lga };
}
