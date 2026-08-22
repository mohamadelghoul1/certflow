import type { Attempt } from "@/lib/nsw/propertyLookup";

// One-shot probe of the candidate NSW endpoints.
//
// The environment this app is developed in cannot reach NSW at all, so
// the endpoint had to be guessed — and the guess was wrong: every call
// came back 404 "Resource not found", which is an API gateway saying the
// path doesn't exist, not a service saying it found no addresses.
//
// Guessing one at a time costs a deploy and a test per attempt. This
// tries every plausible candidate at once and reports which answered, so
// the right one can be identified from a single run. Several are
// deliberately discovery URLs — an ArcGIS REST root with ?f=json lists
// the services it holds, which names them rather than guessing again.
const TIMEOUT_MS = 8000;

function candidates(address: string) {
  const a = encodeURIComponent(address);
  const ep = "https://api.apps1.nsw.gov.au/eplanning/data";
  const six = "https://maps.six.nsw.gov.au/arcgis/rest/services";
  const portal = "https://portal.spatial.nsw.gov.au/server/rest/services";
  return [
    // ePlanning, other spellings and versions of what we tried.
    `${ep}/v0/FetchAddress?a=${a}`,
    `${ep}/v0/fetchAddress?a=${a}`,
    `${ep}/v1/FetchAddress?a=${a}`,
    `${ep}/v0/address?a=${a}`,
    `${ep}/v0/FetchAddress?address=${a}`,
    // Is anything at all served under these paths?
    `${ep}/v0/`,
    "https://api.apps1.nsw.gov.au/eplanning/",
    // NSW Spatial Services. ArcGIS has a fixed, documented interface, so
    // if these answer the response shape is already known.
    `${six}?f=json`,
    `${six}/Locators/NSW_Address_Locator/GeocodeServer/findAddressCandidates?SingleLine=${a}&f=json&outFields=*&maxLocations=5`,
    `${portal}?f=json`,
    `${portal}/NSW_Land_Parcel_Property_Theme/FeatureServer?f=json`,
  ];
}

export async function probeNswEndpoints(address: string): Promise<Attempt[]> {
  const results = await Promise.all(
    candidates(address).map(async (url): Promise<Attempt> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json, text/plain, */*", "User-Agent": "CertFlow/1.0 (+certifier job management)" },
        });
        const text = await res.text();
        return { url, status: res.status, body: text.slice(0, 400) };
      } catch (e) {
        return { url, status: e instanceof Error ? e.name : "failed" };
      } finally {
        clearTimeout(timer);
      }
    })
  );
  // Whatever answered comes first — that's the whole point of the run.
  return results.sort((a, b) => (a.status === 200 ? -1 : b.status === 200 ? 1 : 0));
}
