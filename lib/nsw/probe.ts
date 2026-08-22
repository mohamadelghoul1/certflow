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

  // What a Property record actually looks like. The address field's real
  // format decides how a typed address has to be matched against it, and
  // it had been assumed rather than seen.
  const propSample = await get(`${PORTAL}/NSW_Land_Parcel_Property_Theme/MapServer/12/query?where=1%3D1&outFields=address,housenumber,propid&resultRecordCount=3&returnGeometry=false&f=json`);
  report.propertySample = { status: propSample.status, sample: JSON.stringify(propSample.data).slice(0, 600) };

  // The prefix query the lookup now uses, timed. The first attempt used a
  // leading wildcard and timed out; this shows whether anchoring it fixed
  // that, and is the single most useful number here.
  const words = address.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).slice(0, 2);
  if (words.length) {
    const where = encodeURIComponent(`address LIKE '${words.join(" ")}%'`);
    const url = `${PORTAL}/NSW_Land_Parcel_Property_Theme/MapServer/12/query?where=${where}&outFields=address&returnGeometry=false&resultRecordCount=25&f=json`;
    const started = Date.now();
    const timed = await get(url);
    report.prefixQuery = { url, status: timed.status, tookMs: Date.now() - started, sample: JSON.stringify(timed.data).slice(0, 700) };
  }

  // The service built specifically for address search, in case the parcel
  // service stays too slow to search by address.
  const geo = await get(`${PORTAL}/NSW_Geocoded_Addressing_Theme/MapServer?f=json`);
  report.geocodedAddressing = { status: geo.status, layers: layerList(geo.data).map((l) => `${l.id}: ${l.name}`) };

  // Land zoning is not in the parcel service, and the host it does live
  // on has been guessed twice without success. Rather than guess a third
  // time, this searches for it: each candidate ArcGIS root is asked for
  // its folders and services, and anything whose name mentions zoning,
  // planning, an LEP or an EPI is reported. One run should name the
  // service and layer instead of another round of guessing.
  const roots = [
    "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services",
    "https://mapprod1.environment.nsw.gov.au/arcgis/rest/services",
    "https://mapprod2.environment.nsw.gov.au/arcgis/rest/services",
    PORTAL,
  ];
  const PLANNINGISH = /zon|plan|lep\b|epi\b|land ?use/i;
  const zoning: Record<string, unknown> = {};

  for (const root of roots) {
    const listing = await get(`${root}?f=json`);
    const data = listing.data as Json | undefined;
    if (listing.status !== 200 || !data) {
      zoning[root] = { status: listing.status, body: listing.body?.slice(0, 120) };
      continue;
    }

    const folders = (data.folders as string[] | undefined) || [];
    const services = ((data.services as Json[] | undefined) || []).map((x) => `${x.name} (${x.type})`);
    const entry: Record<string, unknown> = {
      status: 200,
      folders,
      planningServices: services.filter((n) => PLANNINGISH.test(n)),
      serviceCount: services.length,
    };

    // Services are usually inside a folder rather than at the root, so
    // the planning-sounding folders are opened as well.
    const inFolders: Record<string, unknown> = {};
    for (const folder of folders.filter((f) => PLANNINGISH.test(f)).slice(0, 4)) {
      const sub = await get(`${root}/${folder}?f=json`);
      const subServices = (((sub.data as Json | undefined)?.services as Json[] | undefined) || []).map((x) => `${x.name} (${x.type})`);
      inFolders[folder] = subServices.filter((n) => PLANNINGISH.test(n)).slice(0, 25);
    }
    entry.planningFoldersOpened = inFolders;
    zoning[root] = entry;
  }
  report.zoningSearch = zoning;

  // And the layer lists of the services currently being tried, so if one
  // of them is right the layer number comes straight back.
  const tried = [
    "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/ePlanning/Planning_Portal_Principal_Planning/MapServer",
    "https://mapprod1.environment.nsw.gov.au/arcgis/rest/services/ePlanning/Planning_Portal_Principal_Planning/MapServer",
    "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer",
  ];
  const triedReport: Record<string, unknown> = {};
  for (const base of tried) {
    const svc = await get(`${base}?f=json`);
    const layers = layerList(svc.data);
    triedReport[base] = {
      status: svc.status,
      zoningLayers: layers.filter((l) => /zon|land ?use/i.test(l.name)).map((l) => `${l.id}: ${l.name}`),
      layerCount: layers.length,
      body: svc.status === 200 ? undefined : svc.body?.slice(0, 120),
    };
  }
  report.zoningServicesTried = triedReport;

  return report;
}
