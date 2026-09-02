// Planning facts about a parcel: its zone, its area, and whether it is
// heritage-affected or bushfire prone.
//
// These come from the NSW Planning Portal's own map services, which are
// ArcGIS MapServers. Two things shape how this is written.
//
// First, the layer numbers move. A service republished with a layer
// inserted renumbers everything after it, and code that asked for "layer
// 19" would then quietly return the wrong answer — which on a planning
// certificate is worse than returning nothing. So this asks the service
// to identify every layer at the point and matches the results by layer
// name, which is stable.
//
// Second, none of it can be reached from the environment this app is
// developed in, so the parsing below is written against the documented
// shape and the network calls are logged in full: /api/address-details
// with &debug=1 shows every request and response, which is the only way
// to tell a wrong endpoint from a blocked one from a parcel NSW holds
// nothing for. Everything fails soft — an unknown answer is left blank
// and the certifier fills it in, because a planning fact guessed wrong
// is worse than one not offered.

import type { Attempt } from "@/lib/nsw/spatial";

// NSW Lambert. Asking for geometry in metres means an area is a
// shoelace sum and nothing more — no projection, and none of the
// latitude distortion that makes a Web Mercator polygon read about a
// third too large in Sydney.
export const NSW_LAMBERT = 3308;

export type PlanningFacts = {
  zone: string | null;
  lotAreaSqm: number | null;
  heritage: string | null;
  bushfire: string | null;
};

export const EMPTY_FACTS: PlanningFacts = { zone: null, lotAreaSqm: null, heritage: null, bushfire: null };

// ---------------------------------------------------------------- area

type Ring = number[][];

// The area of an ArcGIS polygon, in square metres, given rings already in
// a projected coordinate system measured in metres.
//
// Signed shoelace summed over every ring: ArcGIS winds an outer ring one
// way and a hole the other, so the holes subtract themselves and a parcel
// with an easement cut out of it comes back as the land it actually is.
export function polygonAreaSqm(rings: Ring[] | undefined | null): number | null {
  if (!Array.isArray(rings) || rings.length === 0) return null;

  let total = 0;
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 3) continue;
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      if (![x1, y1, x2, y2].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
      sum += x1 * y2 - x2 * y1;
    }
    total += sum / 2;
  }

  const area = Math.abs(total);
  return area > 0 ? area : null;
}

// How an area is written on a certificate: whole metres, because a
// parcel given to the square centimetre reads as false precision.
export function formatArea(sqm: number | null): string {
  if (sqm === null || !Number.isFinite(sqm)) return "";
  return `${Math.round(sqm).toLocaleString("en-AU")} m²`;
}

// ------------------------------------------------------- identify results

// One row of an ArcGIS identify response.
export type IdentifyResult = { layerName?: string; attributes?: Record<string, unknown> };

// ArcGIS writes an empty cell as "Null" or "<Null>" rather than leaving
// it out, and a layer that matched the point but holds nothing for it
// comes back that way. Treated as absent, or every parcel in NSW would
// report its heritage status as the word "Null".
function cleanValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^(null|<null>|n\/a|nil|none|-)$/i.test(text)) return null;
  return text;
}

// The first attribute whose field name matches, in the order asked for —
// so a layer carrying both a code and a description gives up whichever
// the caller wants first.
function attribute(attributes: Record<string, unknown> | undefined, patterns: RegExp[]): string | null {
  if (!attributes) return null;
  for (const pattern of patterns) {
    for (const [field, value] of Object.entries(attributes)) {
      if (!pattern.test(field)) continue;
      const clean = cleanValue(value);
      if (clean) return clean;
    }
  }
  return null;
}

function layerMatching(results: IdentifyResult[], pattern: RegExp): IdentifyResult[] {
  return results.filter((r) => pattern.test(String(r.layerName || "")));
}

// A zone is reported as a code and a name — "R2" and "Low Density
// Residential" — and both are wanted: the code is what a certificate
// carries, the name is what makes it checkable by eye.
export function readZone(results: IdentifyResult[]): string | null {
  for (const row of layerMatching(results, /land\s*zon(e|ing)/i)) {
    const code = attribute(row.attributes, [/^zone$/i, /sym_?code/i, /zone.*code/i, /^class$/i]);
    const name = attribute(row.attributes, [/lay_?class/i, /zone.*name/i, /^description$/i, /land.*use/i]);
    if (code && name && !name.toUpperCase().startsWith(code.toUpperCase())) return `${code} ${name}`;
    if (code) return code;
    if (name) return name;
  }
  return null;
}

// Heritage is a positive finding: a parcel with no heritage layer over it
// returns nothing, which is the ordinary case and reads as "not
// identified" rather than "No".
export function readHeritage(results: IdentifyResult[]): string | null {
  for (const row of layerMatching(results, /heritage/i)) {
    const item =
      attribute(row.attributes, [/item.*name/i, /^name$/i, /^h_?name$/i, /significance/i, /^class$/i, /lay_?class/i]) ||
      attribute(row.attributes, [/item.*no/i, /^i_?no$/i]);
    if (item) return item;
  }
  return null;
}

// Bushfire prone land is mapped in categories — vegetation category 1, 2,
// 3 and buffers. The category matters: it decides which construction
// standard applies, so the category is carried through rather than
// flattened to a yes.
export function readBushfire(results: IdentifyResult[]): string | null {
  for (const row of layerMatching(results, /bush\s*fire/i)) {
    const category = attribute(row.attributes, [/categor/i, /lay_?class/i, /^class$/i, /^type$/i, /^description$/i]);
    if (category) return category;
  }
  return null;
}

export function readPlanningLayers(results: IdentifyResult[]): Omit<PlanningFacts, "lotAreaSqm"> {
  return { zone: readZone(results), heritage: readHeritage(results), bushfire: readBushfire(results) };
}

// ------------------------------------------------------------- the calls

// The Planning Portal's published map services. More than one, because
// which service carries which layer has changed before and identifying
// against all of them costs one request each and cannot pick wrong —
// the layer names decide what is read, not the address of the service.
const PLANNING_SERVICES = [
  "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/ePlanning/Planning_Portal_Principal_Planning/MapServer",
  "https://mapprod1.environment.nsw.gov.au/arcgis/rest/services/ePlanning/Planning_Portal_Principal_Planning/MapServer",
  "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/ePlanning/Planning_Portal_Hazard/MapServer",
  "https://mapprod1.environment.nsw.gov.au/arcgis/rest/services/ePlanning/Planning_Portal_Hazard/MapServer",
];

const TIMEOUT_MS = 8000;

// An identify needs an extent and a display size to work out its
// tolerance in map units. A small square around the point, at a
// tolerance of one pixel, asks "what covers exactly here".
export function identifyUrl(service: string, lon: number, lat: number): string {
  const pad = 0.0005;
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    sr: "4326",
    layers: "all",
    tolerance: "1",
    mapExtent: `${lon - pad},${lat - pad},${lon + pad},${lat + pad}`,
    imageDisplay: "400,400,96",
    returnGeometry: "false",
    f: "json",
  });
  return `${service}/identify?${params}`;
}

async function getJson(url: string, log?: Attempt[]): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json, */*" } });
    const text = await res.text();
    log?.push({ url, status: res.status, body: text.slice(0, 600) });
    if (!res.ok) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch (e) {
    log?.push({ url, status: e instanceof Error ? e.name : "failed" });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function resultsOf(data: Record<string, unknown> | null): IdentifyResult[] {
  const results = data?.results;
  return Array.isArray(results) ? (results as IdentifyResult[]) : [];
}

// Every service asked at once: they are independent, and asked one after
// another this would be four timeouts deep before it gave up.
export async function lookupPlanningLayers(lon: number, lat: number, log?: Attempt[]): Promise<Omit<PlanningFacts, "lotAreaSqm">> {
  const answers = await Promise.all(PLANNING_SERVICES.map((service) => getJson(identifyUrl(service, lon, lat), log)));
  return readPlanningLayers(answers.flatMap(resultsOf));
}
