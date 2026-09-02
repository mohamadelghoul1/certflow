import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { polygonAreaSqm, formatArea, readZone, readHeritage, readBushfire, readPlanningLayers, identifyUrl, resultsOf } from "@/lib/nsw/planning";

// The planning lookup's own arithmetic and reading, which can be proved
// here. What cannot be proved here is the network: this environment has
// no route to the NSW services, so the endpoints and layer names are
// verified against the live service through &debug=1 after deploying.

describe("the area of a parcel", () => {
  // Rings arrive in NSW Lambert, so the numbers are metres and the
  // shoelace is the answer — no projection, no latitude correction.
  test("a rectangle is its own area", () => {
    const rings = [[[0, 0], [20, 0], [20, 32.5], [0, 32.5], [0, 0]]];
    assert.equal(polygonAreaSqm(rings), 650);
  });

  test("the winding direction does not change the answer", () => {
    const clockwise = [[[0, 0], [0, 32.5], [20, 32.5], [20, 0], [0, 0]]];
    assert.equal(polygonAreaSqm(clockwise), 650);
  });

  // An easement or a excluded strata parcel comes back as a second ring
  // wound the other way, and must come off the total rather than add to
  // it.
  test("a hole is subtracted, not added", () => {
    const outer = [[0, 0], [40, 0], [40, 40], [0, 40], [0, 0]];
    const hole = [[10, 10], [10, 20], [20, 20], [20, 10], [10, 10]];
    assert.equal(polygonAreaSqm([outer, hole]), 1500);
  });

  test("nothing usable is null rather than zero", () => {
    assert.equal(polygonAreaSqm([]), null);
    assert.equal(polygonAreaSqm(null), null);
    assert.equal(polygonAreaSqm([[[0, 0], [1, 1]]]), null, "two points are not a polygon");
    assert.equal(polygonAreaSqm([[[0, 0], [10, 0], [10, 0], [0, 0]]]), null, "a zero-area sliver is not an area");
  });

  test("an area is written in whole metres", () => {
    assert.equal(formatArea(650.4), "650 m²");
    assert.equal(formatArea(12345.6), "12,346 m²");
    assert.equal(formatArea(null), "");
  });
});

describe("reading the planning layers", () => {
  const zoning = { layerName: "Land Zoning Map", attributes: { SYM_CODE: "R2", LAY_CLASS: "Low Density Residential" } };
  const heritage = { layerName: "Heritage Map", attributes: { H_NAME: "Cottage and grounds", I_NO: "I123" } };
  const bushfire = { layerName: "Bush Fire Prone Land", attributes: { Category: "Vegetation Category 1" } };

  test("a zone comes back as its code and its name", () => {
    assert.equal(readZone([zoning]), "R2 Low Density Residential");
  });

  test("a zone with only a code still answers", () => {
    assert.equal(readZone([{ layerName: "Land Zoning Map", attributes: { SYM_CODE: "R2" } }]), "R2");
  });

  test("a heritage item is named", () => {
    assert.equal(readHeritage([heritage]), "Cottage and grounds");
  });

  test("a bushfire category is carried through, not flattened to a yes", () => {
    assert.equal(readBushfire([bushfire]), "Vegetation Category 1");
  });

  // The distinction the whole panel rests on: no layer over the parcel
  // is "not identified", never "No". Reading silence as a clearance is
  // how a certificate gets issued on a premise nobody checked.
  test("a layer that returned nothing is null, not a negative", () => {
    assert.deepEqual(readPlanningLayers([zoning]), { zone: "R2 Low Density Residential", heritage: null, bushfire: null });
  });

  // ArcGIS writes an empty cell as the word "Null", and every parcel in
  // NSW would otherwise report its heritage as "Null".
  test("ArcGIS's own empty values are treated as absent", () => {
    assert.equal(readHeritage([{ layerName: "Heritage Map", attributes: { H_NAME: "Null", I_NO: "<Null>" } }]), null);
    assert.equal(readBushfire([{ layerName: "Bush Fire Prone Land", attributes: { Category: " " } }]), null);
  });

  // Layer numbers move when a service is republished; names do not. A
  // result from a layer this does not recognise is ignored rather than
  // read as something it isn't.
  test("only the named layers are read", () => {
    const results = [{ layerName: "Floor Space Ratio", attributes: { SYM_CODE: "0.5:1" } }, zoning];
    assert.equal(readZone(results), "R2 Low Density Residential", "the FSR layer's code is not mistaken for a zone");
  });

  test("all three are read from one mixed response", () => {
    assert.deepEqual(readPlanningLayers([bushfire, zoning, heritage]), {
      zone: "R2 Low Density Residential",
      heritage: "Cottage and grounds",
      bushfire: "Vegetation Category 1",
    });
  });
});

describe("the identify request", () => {
  test("asks every layer at the point, in degrees, with an extent around it", () => {
    const url = identifyUrl("https://example/MapServer", 150.9, -33.87);
    assert.ok(url.startsWith("https://example/MapServer/identify?"));
    const params = new URLSearchParams(url.split("?")[1]);
    assert.equal(params.get("layers"), "all", "layer numbers move; asking for all of them cannot pick wrong");
    assert.equal(params.get("sr"), "4326");
    assert.equal(params.get("geometryType"), "esriGeometryPoint");
    assert.equal(params.get("returnGeometry"), "false");
    assert.deepEqual(JSON.parse(params.get("geometry")!), { x: 150.9, y: -33.87, spatialReference: { wkid: 4326 } });
    const [xmin, ymin, xmax, ymax] = params.get("mapExtent")!.split(",").map(Number);
    assert.ok(xmin < 150.9 && 150.9 < xmax && ymin < -33.87 && -33.87 < ymax, "the point sits inside the extent asked about");
  });

  test("a response that is not an identify response reads as nothing", () => {
    assert.deepEqual(resultsOf(null), []);
    assert.deepEqual(resultsOf({ error: { code: 400 } }), []);
    assert.deepEqual(resultsOf({ results: [] }), []);
  });
});
