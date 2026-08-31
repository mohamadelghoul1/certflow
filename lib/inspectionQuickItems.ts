// The standard lines a certifier writes on nearly every inspection of a
// given stage — the engineer's certificate after piers, termite
// protection before a slab pour. Each prints on the report under
// REQUIRED DOCUMENTS exactly as if it had been typed; offering them as
// tick boxes only saves typing the same sentences on every job.
//
// Matched against the inspection's title by keyword rather than exact
// name, so a custom-typed "Stormwater connections" gets the stormwater
// set alongside the built-in "Stormwater". An inspection with no
// standard set (a pool fence, a suspended slab) simply shows no boxes.

const SETS: { match: RegExp; items: string[] }[] = [
  {
    match: /pier/i,
    items: ["Structural Engineer to provide Piers Compliance Certificate", "Registered Surveyor to provide Setout Survey"],
  },
  {
    match: /footing/i,
    items: [
      "Structural Engineer to provide Compliance Certificate",
      "Registered Surveyor to provide Setout Survey",
      "Termite Protection to be installed prior to pouring",
    ],
  },
  {
    match: /frame/i,
    items: [
      "Structural Engineer to provide Compliance Certificate for the Frame as constructed/structural steel (As Applicable)",
      "Registered Surveyor to provide Setout Survey confirming the building location and height",
    ],
  },
  {
    match: /waterproof/i,
    items: ["Waterproofing certification to be provided"],
  },
  {
    match: /stormwater/i,
    items: [
      "Plumber must provide stormwater compliance certificate",
      "Hydraulic engineer to provide Stormwater Compliance Certificate",
      "Registered Surveyor to provide Works As Executed Plan for the constructed Stormwater System",
    ],
  },
  {
    match: /final/i,
    items: ["A final inspection checklist will be provided"],
  },
];

export function quickItemsFor(title: string | null | undefined): string[] {
  if (!title) return [];
  return SETS.find((s) => s.match.test(title))?.items ?? [];
}

// Whether a recorded item is one of the standard lines, ignoring case
// and stray spaces — a ticked box and a hand-typed copy of the same
// sentence are the same item.
export function isQuickItem(text: string, quickItems: string[]): boolean {
  const t = text.trim().toLowerCase();
  return quickItems.some((q) => q.trim().toLowerCase() === t);
}
