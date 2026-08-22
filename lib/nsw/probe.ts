// Discovery against NSW Spatial Services' ArcGIS REST API.
//
// The earlier probe settled two things. Every ePlanning endpoint
// (api.apps1.nsw.gov.au/eplanning/...) answers 404 "Resource not found",
// as does maps.six.nsw.gov.au — so the service this was originally
// written against is gone. But portal.spatial.nsw.gov.au answers 200, and
// it holds NSW_Land_Parcel_Property_Theme, which is the parcel and
// property data we want.
//
// What's still unknown is the shape inside that service: which layer
// holds addresses, which holds lots, and what their fields are called.
// This walks the service and reports that, so it can be wired up from
// fact rather than another guess.

const PORTAL = "https://portal.spatial.nsw.gov.au/server/rest/services";
const TIMEOUT_MS = 9000;

type Json = Record<string, unknown>;

async function get(url: string): Promise<{ status: number | string; data?: unknown; body?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json, */*" } });
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, body: text.slice(0, 200) };
    }
  } catch (e) {
    return { status: e instanceof Error ? e.name : "failed" };
  } finally {
    clearTimeout(timer);
  }
}

function layerList(data: unknown): { id: number; name: string }[] {
  const d = data as Json | undefined;
  const out: { id: number; name: string }[] = [];
  for (const key of ["layers", "tables"]) {
    const arr = d?.[key];
    if (Array.isArray(arr)) {
      for (const l of arr) {
        const layer = l as Json;
        if (typeof layer.id === "number" && typeof layer.name === "string") out.push({ id: layer.id, name: layer.name });
      }
    }
  }
  return out;
}

// Field names matter as much as layer ids — a query needs to know what
// the address and lot columns are actually called.
function fieldNames(data: unknown): string[] {
  const fields = (data as Json | undefined)?.fields;
  if (!Array.isArray(fields)) return [];
  return fields.map((f) => String((f as Json).name)).filter(Boolean);
}

const INTERESTING = /address|lot|parcel|property|cadas|plan/i;

export async function probeNswEndpoints(address: string) {
  const report: Record<string, unknown> = { address };

  // Which services exist, narrowed to the ones that could hold parcels or
  // addresses — the full list is long and mostly imagery.
  const root = await get(`${PORTAL}?f=json`);
  const services = ((root.data as Json | undefined)?.services as Json[] | undefined) || [];
  report.matchingServices = services.map((s) => `${s.name} (${s.type})`).filter((n) => INTERESTING.test(n));
  report.folders = (root.data as Json | undefined)?.folders;

  // The parcel service, as both FeatureServer and MapServer — which one
  // supports querying varies by service.
  for (const kind of ["FeatureServer", "MapServer"]) {
    const svc = await get(`${PORTAL}/NSW_Land_Parcel_Property_Theme/${kind}?f=json`);
    const layers = layerList(svc.data);
    report[`${kind}_status`] = svc.status;
    report[`${kind}_layers`] = layers.map((l) => `${l.id}: ${l.name}`);

    // Fields for the layers whose names suggest they hold what we need.
    const targets = layers.filter((l) => INTERESTING.test(l.name)).slice(0, 6);
    const detail: Record<string, unknown> = {};
    for (const layer of targets) {
      const meta = await get(`${PORTAL}/NSW_Land_Parcel_Property_Theme/${kind}/${layer.id}?f=json`);
      detail[`${layer.id}: ${layer.name}`] = fieldNames(meta.data).slice(0, 30);
    }
    report[`${kind}_fields`] = detail;

    // A real query against the first candidate layer, to confirm querying
    // works at all and to show what a record actually looks like.
    if (targets.length) {
      const q = `${PORTAL}/NSW_Land_Parcel_Property_Theme/${kind}/${targets[0].id}/query?where=1%3D1&outFields=*&resultRecordCount=1&f=json`;
      const sample = await get(q);
      report[`${kind}_sampleQuery`] = { url: q, status: sample.status, sample: JSON.stringify(sample.data).slice(0, 900) };
    }
  }

  return report;
}
