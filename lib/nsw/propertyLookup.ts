// Reading Lot/Section/Plan out of free text — an address the certifier
// pasted in, or a value returned by NSW.
//
// The NSW calls that used to live here have moved to lib/nsw/spatial.ts.
// They went to the ePlanning API, which answers 404 for every endpoint —
// that service is gone — and were rewritten against NSW Spatial Services.

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
