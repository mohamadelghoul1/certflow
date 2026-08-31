import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { quickItemsFor, isQuickItem } from "@/lib/inspectionQuickItems";

// The standard document lines are the certifier's own wording, written
// into the software at their request — so these tests hold the sentences
// themselves, not just their shape. A reworded line here is a reworded
// line on every report that follows.
describe("standard items for each inspection stage", () => {
  test("piers", () => {
    assert.deepEqual(quickItemsFor("Piers"), [
      "Structural Engineer to provide Piers Compliance Certificate",
      "Registered Surveyor to provide Setout Survey",
    ]);
  });

  test("footings and slab", () => {
    assert.deepEqual(quickItemsFor("Footings and Slab"), [
      "Structural Engineer to provide Compliance Certificate",
      "Registered Surveyor to provide Setout Survey",
      "Termite Protection to be installed prior to pouring",
    ]);
  });

  test("frame", () => {
    assert.deepEqual(quickItemsFor("Frame"), [
      "Structural Engineer to provide Compliance Certificate for the Frame as constructed/structural steel (As Applicable)",
      "Registered Surveyor to provide Setout Survey confirming the building location and height",
    ]);
  });

  test("wet area waterproofing", () => {
    assert.deepEqual(quickItemsFor("Wet Area Waterproofing"), ["Waterproofing certification to be provided"]);
  });

  test("stormwater", () => {
    assert.deepEqual(quickItemsFor("Stormwater"), [
      "Plumber must provide stormwater compliance certificate",
      "Hydraulic engineer to provide Stormwater Compliance Certificate",
      "Registered Surveyor to provide Works As Executed Plan for the constructed Stormwater System",
    ]);
  });

  test("final", () => {
    assert.deepEqual(quickItemsFor("Final"), ["A final inspection checklist will be provided"]);
  });

  // Titles are typed as well as picked from the list, so matching is by
  // keyword rather than exact name.
  test("a custom-typed title still finds its stage", () => {
    assert.equal(quickItemsFor("stormwater connections").length, 3);
    assert.equal(quickItemsFor("FINAL INSPECTION")[0], "A final inspection checklist will be provided");
  });

  test("a stage with no standard set shows no boxes", () => {
    assert.deepEqual(quickItemsFor("Pool Fence"), []);
    assert.deepEqual(quickItemsFor("Suspended Slab"), []);
    assert.deepEqual(quickItemsFor(""), []);
    assert.deepEqual(quickItemsFor(null), []);
  });
});

describe("recognising a standard line already in the list", () => {
  const items = quickItemsFor("Piers");

  test("case and stray spaces do not make it a different item", () => {
    assert.equal(isQuickItem("  structural engineer to provide piers compliance certificate ", items), true);
  });

  test("a hand-typed variant stays an ordinary editable item", () => {
    assert.equal(isQuickItem("Structural Engineer to provide certificate", items), false);
  });
});
