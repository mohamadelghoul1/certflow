// Splitting a one-line address into the parts a certificate prints.
//
// A property address is held as one line; a certificate prints street
// number, street, suburb, state and postcode separately. Used when
// importing jobs from another system, and whenever an applicant's
// address is taken to be the property's.
//
// Anything that cannot be read confidently is left whole in the street
// line, where it is visible and easily corrected, never silently
// dropped.

export type SplitAddress = { streetNumber: string; street: string; suburb: string; state: string; postcode: string };

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

// The words that end a street name, so an address written without
// commas can still be divided: "378 Scenic Drive San Remo".
const STREET_TYPES = [
  "street", "st", "road", "rd", "drive", "dr", "avenue", "ave", "av", "way", "lane", "ln", "place", "pl", "court", "ct",
  "crescent", "cres", "parade", "pde", "close", "cl", "terrace", "tce", "circuit", "cct", "boulevard", "bvd", "highway", "hwy",
  "esplanade", "esp", "grove", "gr", "rise", "view", "walk", "circle", "square", "sq", "loop", "mews", "parkway", "track", "trail",
];

export function splitAddress(input: string): SplitAddress {
  const empty: SplitAddress = { streetNumber: "", street: "", suburb: "", state: "NSW", postcode: "" };
  let rest = (input || "").trim().replace(/\s+/g, " ");
  if (!rest) return empty;

  let postcode = "";
  const postcodeMatch = /[\s,]+(\d{4})$/.exec(rest);
  if (postcodeMatch) {
    postcode = postcodeMatch[1];
    rest = rest.slice(0, postcodeMatch.index).trim();
  }

  let state = "";
  const stateMatch = new RegExp(`[\\s,]+(${STATES.join("|")})$`, "i").exec(rest);
  if (stateMatch) {
    state = stateMatch[1].toUpperCase();
    rest = rest.slice(0, stateMatch.index).trim();
  }
  rest = rest.replace(/,\s*$/, "").trim();

  let streetLine = rest;
  let suburb = "";

  const commaAt = rest.lastIndexOf(",");
  if (commaAt >= 0) {
    streetLine = rest.slice(0, commaAt).trim();
    suburb = rest.slice(commaAt + 1).trim();
  } else {
    // No comma: the street type is the divide. Searched from the end, so
    // a suburb that happens to contain one ("Kings Park Road, Five Dock")
    // does not split the line too early.
    const words = rest.split(" ");
    let divide = -1;
    for (let i = words.length - 1; i >= 0; i--) {
      if (STREET_TYPES.includes(words[i].toLowerCase().replace(/[^a-z]/g, ""))) {
        divide = i;
        break;
      }
    }
    if (divide >= 0 && divide < words.length - 1) {
      streetLine = words.slice(0, divide + 1).join(" ");
      suburb = words.slice(divide + 1).join(" ");
    }
  }

  // The leading token is the number when it carries a digit — which
  // covers "21", "12A" and "Unit 2/5" alike.
  let streetNumber = "";
  let street = streetLine;
  const numberMatch = /^([\w/\-.]*\d[\w/\-.]*)\s+(.+)$/.exec(streetLine);
  if (numberMatch) {
    streetNumber = numberMatch[1];
    street = numberMatch[2];
  } else {
    // A unit or suite spelt out in front of the number: "Suite 2/F1 101
    // Rookwood Road" — everything up to the last number-bearing token is
    // the number.
    const unitMatch = /^((?:unit|suite|shop|level|apt|apartment)\s+[\w/\-.]*\d[\w/\-.]*(?:\s+[\w/\-.]*\d[\w/\-.]*)*)\s+(.+)$/i.exec(streetLine);
    if (unitMatch) {
      streetNumber = unitMatch[1];
      street = unitMatch[2];
    }
  }

  return { streetNumber, street: street.trim(), suburb: suburb.trim(), state: state || "NSW", postcode };
}
