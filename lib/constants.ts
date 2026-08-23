// Reference data ported from the certflow-client-portal.jsx prototype.
// Kept as plain constants (not DB rows) since every firm on this software
// starts from the same standard library — a firm can still add ad-hoc items
// per job on top of this.

export const DOC_LIBRARY: Record<string, { title: string; desc: string; category: string }[]> = {
  CDC: [
    { title: "CDC Application Form", desc: "Complete and lodge the CDC application.", category: "Other" },
    { title: "Site Plan", desc: "Site plan showing setbacks, boundaries and existing structures.", category: "Architectural" },
    { title: "Architectural Plans", desc: "Full set of architectural plans and elevations.", category: "Architectural" },
    { title: "BASIX Certificate", desc: "Valid BASIX certificate consistent with plans.", category: "Other" },
    { title: "Shadow Diagrams", desc: "Shadow diagrams demonstrating overshadowing compliance.", category: "Architectural" },
    { title: "Stormwater Concept Plan", desc: "Concept stormwater management plan.", category: "Engineering" },
  ],
  CC: [
    { title: "CC Application Form", desc: "Complete and lodge the CC application.", category: "Other" },
    { title: "Architectural Plans", desc: "Full set of architectural plans and elevations.", category: "Architectural" },
    { title: "Structural Engineering Details", desc: "Structural plans and computations.", category: "Structural" },
    { title: "BASIX Certificate", desc: "Valid BASIX certificate consistent with plans.", category: "Other" },
    { title: "Fire Safety Schedule", desc: "Schedule of fire safety measures (if applicable).", category: "Other" },
  ],
  NOC: [
    { title: "Notice of Commencement", desc: "Submit at least 2 days prior to works starting.", category: "Other" },
    { title: "Appointment of PCA", desc: "Formal appointment of the Principal Certifying Authority.", category: "Other" },
    { title: "Long Service Levy Receipt", desc: "Evidence of payment of the Long Service Levy.", category: "Other" },
    { title: "Home Building Compensation Certificate", desc: "Insurance certificate for works over $20,000.", category: "Other" },
  ],
  OC: [
    { title: "OC Application Form", desc: "Complete and submit the OC Application Form.", category: "Other" },
    { title: "BASIX Completion Receipt", desc: "Obtained on completion of works.", category: "Other" },
    { title: "Works as Executed Stormwater Plan", desc: "Prepared by a registered surveyor, approved by a civil engineer.", category: "Engineering" },
    { title: "Section 73 Compliance Certificate", desc: "Sydney Water compliance certificate for completed works.", category: "Other" },
    { title: "Final Survey", desc: "Survey confirming RLs, ridgelines and setbacks.", category: "Other" },
    { title: "Termite Protection Certificate", desc: "Certification per AS3660.1-2000 and BCA Clause B1.4.", category: "Other" },
    { title: "Landscaping Certification", desc: "Certification that landscape works meet approved plans.", category: "Other" },
    { title: "Smoke Alarm Compliance", desc: "Certification of smoke alarm installation.", category: "Other" },
  ],
};

export const MANDATORY_CRITICAL_STAGE_INSPECTIONS = [
  { no: 1, stage: "After excavation for and prior to placement of any footings", inspector: "Registered Certifier & Structural Engineer" },
  { no: 2, stage: "Prior to pouring any in-situ reinforced concrete building element", inspector: "Registered Certifier & Structural Engineer" },
  { no: 3, stage: "Prior to covering of the framework for any floor, wall, roof, or other building element", inspector: "Registered Certifier & Structural Engineer" },
  { no: 4, stage: "Prior to covering waterproofing in any wet areas", inspector: "Registered Certifier" },
  { no: 5, stage: "Prior to covering any stormwater drainage connections", inspector: "Registered Certifier" },
  { no: 6, stage: "After the building work has been completed & prior to any Occupation Certificate being issued in relation to the building", inspector: "Principal Certifier" },
];

// Starting point for a new job's critical_stage_inspections — copied in as
// plain per-job data (not a live reference to the list above), so each job
// can freely add extra inspections or edit/remove these ones afterward.
export function defaultCriticalStageInspections() {
  return MANDATORY_CRITICAL_STAGE_INSPECTIONS.map((i) => ({ id: String(i.no), stage: i.stage, inspector: i.inspector, enabled: true }));
}

// Jobs created before per-job critical stage inspections existed still store
// the old shape (a plain list of numbers referencing MANDATORY_CRITICAL_STAGE_INSPECTIONS,
// where presence meant "enabled"). Reading that old shape as the new
// {id, stage, inspector, enabled} objects leaves every row with the same
// missing id, so ticking one checkbox matches and toggles every row. This
// reconstructs the full editable list from either shape so old jobs self-heal
// on first read/save instead of relying on the one-off SQL migration having run.
export function normalizeCriticalStageInspections(raw: unknown): { id: string; stage: string; inspector: string; enabled: boolean }[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > 0 && typeof raw[0] !== "object") {
    const enabledNos = new Set(raw.map(Number));
    return MANDATORY_CRITICAL_STAGE_INSPECTIONS.map((m) => ({
      id: String(m.no),
      stage: m.stage,
      inspector: m.inspector,
      enabled: enabledNos.has(m.no),
    }));
  }
  return raw.map((item, idx) => {
    const obj = (item || {}) as { id?: string; stage?: string; inspector?: string; enabled?: boolean };
    return {
      id: obj.id ? String(obj.id) : `row-${idx}`,
      stage: obj.stage || "",
      inspector: obj.inspector || "",
      enabled: obj.enabled !== false,
    };
  });
}

export const INSPECTION_LIBRARY = [
  { title: "Prior to CC/CDC", desc: "Site inspection prior to issue of CC or CDC." },
  { title: "Piers & Footings", desc: "Inspection of piers and footings prior to pour." },
  { title: "Slab Steel", desc: "Inspection of slab reinforcement prior to pour." },
  { title: "Frame", desc: "Inspection of structural frame prior to lock-up." },
  { title: "Waterproofing", desc: "Inspection of wet area waterproofing." },
  { title: "Stormwater", desc: "Inspection of stormwater drainage installation." },
  { title: "Final", desc: "Final inspection prior to occupation." },
];

export const JOB_TYPES = ["Secondary Dwelling", "Dual Occupancy", "Alterations & Additions", "New Dwelling", "Pool"];

// Not exhaustive — certifiers can also just type any version directly into
// the BCA/NCC field (it's a free-text input with this list as suggestions),
// so a new amendment doesn't need a code change to be usable.
// NCC volumes are ticked independently of the version — a job can be
// assessed against more than one (e.g. a dwelling plus a Class 10 shed).
export const BCA_VOLUMES = ["Volume One", "Volume Two", "Volume Three"];

// The versions this firm assesses against, oldest first. The field itself
// is free text with these as suggestions, so a job already recorded
// against something else keeps its value and still prints correctly —
// this list only decides what's offered when typing.
export const BCA_VERSIONS = ["NCC 2016", "NCC 2019", "NCC 2019.1", "NCC 2022", "NCC 2022 Amendment 1", "NCC 2022 Amendment 2"];

export const BUILDING_CLASSIFICATIONS = [
  "Class 1a — Single dwelling",
  "Class 1b — Boarding house / B&B",
  "Class 2 — Apartments / multi-unit residential",
  "Class 3 — Residential (hotel, motel, hostel, boarding house)",
  "Class 4 — Residential part of a commercial building",
  "Class 5 — Office building",
  "Class 6 — Shop / retail / cafe / restaurant",
  "Class 7a — Carpark",
  "Class 7b — Warehouse / storage",
  "Class 8 — Laboratory / factory (industrial)",
  "Class 9a — Health care building",
  "Class 9b — Assembly building (school, hall, theatre)",
  "Class 9c — Aged care building",
  "Class 10a — Non-habitable (garage, shed, carport)",
  "Class 10b — Structure (pool, fence, retaining wall)",
  "Class 10c — Private bushfire shelter",
];
export const CONSTRUCTION_TYPES = ["N/A", "Type A", "Type B", "Type C"];
export const NSW_STATE = ["NSW", "ACT", "QLD", "VIC"];

export const SEPP_CODE_PARTS = [
  "Part 1", "Part 2", "Part 2A", "Part 3", "Part 3A", "Part 3B", "Part 3BA", "Part 3C", "Part 3D",
  "Part 4", "Part 4A", "Part 5", "Part 5A", "Part 5B", "Part 6", "Part 7", "Part 8",
  "Schedule One Complying Development Secondary Dwelling",
];
export const SEPP_CODES_2008_NAME = "State Environmental Planning Policy (Exempt and Complying Development Codes) 2008";
export const SEPP_HOUSING_2021_NAME = "State Environmental Planning Policy (Housing) 2021";
export const CODE_PART_EPI_OVERRIDES: Record<string, string> = {
  "Schedule One Complying Development Secondary Dwelling": SEPP_HOUSING_2021_NAME,
};
export function epiForCodeParts(parts: string[]) {
  const names = new Set<string>();
  parts.forEach((p) => names.add(CODE_PART_EPI_OVERRIDES[p] || SEPP_CODES_2008_NAME));
  return [...names].join(" & ");
}

export const VALID_FOR_OPTIONS = ["7 Days", "14 Days", "30 Days", "60 Days"];
export const CLIENT_TYPES = ["Architect", "Builder", "Owner", "Other"];

export const QUOTE_STATUS_META: Record<string, { label: string; style: string }> = {
  draft: { label: "Draft", style: "bg-slate-100 text-slate-600" },
  sent: { label: "Sent", style: "bg-blue-50 text-blue-700" },
  accepted: { label: "Accepted", style: "bg-emerald-50 text-emerald-700" },
  declined: { label: "Declined", style: "bg-red-50 text-red-700" },
};

// Council directory — every council across Greater Sydney (33 LGAs, which
// includes Wollondilly), plus Central Coast and Wollongong. Selecting one
// auto-fills its address and contact details; anything not listed here
// still works as free text. See Build Brief §8 for the real NSW Spatial
// Services lookup this should eventually be backed by.
export const COUNCIL_DIRECTORY = [
  { name: "Bayside Council", address: { streetNumber: "444-446", street: "Princes Highway", suburb: "Rockdale", state: "NSW", postcode: "2216" }, phone: "02 9562 1666", fax: "", email: "council@bayside.nsw.gov.au", suburbs: ["Rockdale", "Brighton-Le-Sands", "Bexley", "Arncliffe", "Banksia", "Mascot", "Botany", "Eastlakes", "Pagewood", "Bexley North", "Kyeemagh", "Monterey", "Ramsgate", "Ramsgate Beach", "Sandringham", "Dolls Point", "Sans Souci", "Turrella", "Wolli Creek", "Bardwell Park", "Bardwell Valley", "Banksmeadow", "Port Botany", "Daceyville", "Hillsdale", "Chifley", "Phillip Bay", "Little Bay", "La Perouse", "Sydney Airport"] },
  { name: "Blacktown City Council", address: { streetNumber: "62", street: "Flushcombe Road", suburb: "Blacktown", state: "NSW", postcode: "2148" }, phone: "02 9839 6000", fax: "02 9831 1961", email: "council@blacktown.nsw.gov.au", suburbs: ["Blacktown", "Mount Druitt", "Rooty Hill", "Doonside", "Seven Hills", "Marayong", "Quakers Hill", "Glenwood", "Stanhope Gardens", "Riverstone", "Schofields", "Kings Langley", "Lalor Park", "Prospect", "Woodcroft", "Plumpton", "Glendenning", "Hebersham", "Emerton", "Tregear", "Whalan", "Shalvey", "Bidwill", "Blackett", "Dharruk", "Colebee", "Marsden Park", "The Ponds", "Kellyville Ridge", "Parklea", "Acacia Gardens", "Arndell Park", "Huntingwood", "Bungarribee", "Willmot", "Lethbridge Park", "Minchinbury", "Oakhurst", "Hassall Grove", "Dean Park", "Kings Park", "Eastern Creek", "Ropes Crossing", "Shanes Park", "Tallawong", "Nirimba Fields"] },
  { name: "Blue Mountains City Council", address: { streetNumber: "2", street: "Civic Place", suburb: "Katoomba", state: "NSW", postcode: "2780" }, phone: "02 4780 5000", fax: "02 4780 5555", email: "council@bmcc.nsw.gov.au", suburbs: ["Katoomba", "Springwood", "Leura", "Blaxland", "Glenbrook", "Lawson", "Wentworth Falls", "Mount Victoria", "Hazelbrook", "Woodford", "Faulconbridge", "Winmalee", "Valley Heights", "Warrimoo", "Bullaburra", "Medlow Bath", "Blackheath", "Mount Riverview", "Emu Heights"] },
  { name: "Burwood Council", address: { streetNumber: "2", street: "Conder Street", suburb: "Burwood", state: "NSW", postcode: "2134" }, phone: "02 9911 9911", fax: "02 9911 9900", email: "council@burwood.nsw.gov.au", suburbs: ["Burwood", "Croydon", "Burwood Heights", "Enfield"] },
  { name: "Camden Council", address: { streetNumber: "70", street: "Central Avenue", suburb: "Oran Park", state: "NSW", postcode: "2570" }, phone: "02 4654 7777", fax: "02 4654 7829", email: "mail@camden.nsw.gov.au", suburbs: ["Camden", "Oran Park", "Narellan", "Mount Annan", "Elderslie", "Harrington Park", "Currans Hill", "Gregory Hills", "Smeaton Grange", "Spring Farm", "Catherine Field", "Gledswood Hills", "Cobbitty", "Grasmere", "Ellis Lane", "Narellan Vale", "Emerald Hills"] },
  { name: "Campbelltown City Council", address: { streetNumber: "", street: "Civic Centre, Cnr Queen & Broughton Streets", suburb: "Campbelltown", state: "NSW", postcode: "2560" }, phone: "02 4645 4000", fax: "02 4645 4111", email: "council@campbelltown.nsw.gov.au", suburbs: ["Campbelltown", "Ingleburn", "Minto", "Raby", "Airds", "Rosemeadow", "Claymore", "Glen Alpine", "Leumeah", "Bradbury", "Ambarvale", "St Helens Park", "Woodbine", "Blair Athol", "Ruse", "Kearns", "Eschol Park", "Eagle Vale", "Bow Bowing", "Macquarie Fields", "Glenfield", "Varroville", "Menangle Park", "Minto Heights", "Long Point", "Gilead"] },
  { name: "City of Canada Bay Council", address: { streetNumber: "1A", street: "Marlborough Street", suburb: "Drummoyne", state: "NSW", postcode: "2047" }, phone: "02 9911 6555", fax: "02 9911 6550", email: "council@canadabay.nsw.gov.au", suburbs: ["Drummoyne", "Concord", "Five Dock", "Rodd Point", "Russell Lea", "Abbotsford", "Chiswick", "Cabarita", "Mortlake", "Breakfast Point", "Liberty Grove", "Wareemba", "North Strathfield", "Canada Bay"] },
  { name: "Canterbury-Bankstown Council", address: { streetNumber: "66-72", street: "Rickard Road", suburb: "Bankstown", state: "NSW", postcode: "2200" }, phone: "02 9707 9000", fax: "02 9707 9700", email: "council@cbcity.nsw.gov.au", suburbs: ["Bankstown", "Canterbury", "Campsie", "Punchbowl", "Lakemba", "Belmore", "Roselands", "Padstow", "Panania", "Revesby", "Yagoona", "Birrong", "Chester Hill", "Sefton", "Condell Park", "Georges Hall", "Bass Hill", "Milperra", "Picnic Point", "East Hills", "Greenacre", "Chullora", "Wiley Park", "Earlwood", "Croydon Park", "Belfield", "Mount Lewis", "Bankstown Airport"] },
  { name: "Cumberland Council", address: { streetNumber: "16", street: "Memorial Avenue", suburb: "Merrylands", state: "NSW", postcode: "2160" }, phone: "02 8757 9000", fax: "02 9840 9734", email: "council@cumberland.nsw.gov.au", suburbs: ["Merrylands", "Granville", "Auburn", "Lidcombe", "Guildford", "Greystanes", "Wentworthville", "South Wentworthville", "Regents Park", "Berala", "Girraween", "Pendle Hill", "Toongabbie", "Merrylands West", "Mays Hill", "Holroyd", "Pemulwuy", "Woodpark", "South Granville", "Smithfield West", "Guildford West", "Old Toongabbie"] },
  { name: "Fairfield City Council", address: { streetNumber: "86", street: "Avoca Road", suburb: "Wakeley", state: "NSW", postcode: "2176" }, phone: "02 9725 0222", fax: "02 9725 4249", email: "mail@fairfieldcity.nsw.gov.au", suburbs: ["Fairfield", "Cabramatta", "Wakeley", "Bonnyrigg", "Canley Heights", "Canley Vale", "Prairiewood", "Smithfield", "Yennora", "Fairfield West", "St Johns Park", "Old Guildford", "Fairfield Heights", "Carramar", "Lansvale", "Mount Pritchard", "Edensor Park", "Abbotsbury", "Bossley Park", "Greenfield Park", "Cecil Park", "Horsley Park", "Wetherill Park", "Fairfield East", "Bonnyrigg Heights"] },
  { name: "Georges River Council", address: { streetNumber: "", street: "Georges River Civic Centre, Cnr MacMahon and Dora Streets", suburb: "Hurstville", state: "NSW", postcode: "2220" }, phone: "02 9330 6400", fax: "", email: "mail@georgesriver.nsw.gov.au", suburbs: ["Hurstville", "Penshurst", "Mortdale", "Peakhurst", "Oatley", "Beverly Hills", "Riverwood", "South Hurstville", "Kogarah", "Kogarah Bay", "Carlton", "Allawah", "Beverley Park", "Blakehurst", "Connells Point", "Kyle Bay", "Lugarno", "Narwee", "Peakhurst Heights", "Kingsgrove", "Carss Park"] },
  { name: "Hawkesbury City Council", address: { streetNumber: "366", street: "George Street", suburb: "Windsor", state: "NSW", postcode: "2756" }, phone: "02 4560 4444", fax: "02 4587 7740", email: "council@hawkesbury.nsw.gov.au", suburbs: ["Windsor", "Richmond", "Kurrajong", "North Richmond", "Wilberforce", "Pitt Town", "South Windsor", "Bligh Park", "McGraths Hill", "Glossodia", "Freemans Reach", "Grose Vale", "Kurmond", "Colo", "Ebenezer"] },
  { name: "Hornsby Shire Council", address: { streetNumber: "296", street: "Peats Ferry Road", suburb: "Hornsby", state: "NSW", postcode: "2077" }, phone: "02 9847 6666", fax: "02 9847 6999", email: "hsc@hornsby.nsw.gov.au", suburbs: ["Hornsby", "Waitara", "Asquith", "Berowra", "Mount Colah", "Mount Kuring-gai", "Pennant Hills", "Cherrybrook", "Thornleigh", "Normanhurst", "Beecroft", "Galston", "Arcadia", "Glenorie", "Hornsby Heights", "Westleigh", "Brooklyn", "Cowan"] },
  { name: "Hunter's Hill Council", address: { streetNumber: "22", street: "Alexandra Street", suburb: "Hunters Hill", state: "NSW", postcode: "2110" }, phone: "02 9879 9400", fax: "", email: "customerservice@huntershill.nsw.gov.au", suburbs: ["Hunters Hill", "Woolwich", "Boronia Park", "Henley", "Huntleys Point", "Huntleys Cove"] },
  { name: "Inner West Council", address: { streetNumber: "260", street: "Liverpool Road", suburb: "Ashfield", state: "NSW", postcode: "2131" }, phone: "02 9392 5000", fax: "02 9392 5911", email: "council@innerwest.nsw.gov.au", suburbs: ["Ashfield", "Leichhardt", "Marrickville", "Balmain", "Newtown", "Petersham", "Summer Hill", "Dulwich Hill", "Annandale", "Rozelle", "Stanmore", "Enmore", "Lewisham", "Lilyfield", "Haberfield", "Croydon Park South", "Sydenham", "Tempe", "St Peters", "Camperdown", "Hurlstone Park", "Birchgrove", "Erskineville"] },
  { name: "Ku-ring-gai Council", address: { streetNumber: "818", street: "Pacific Highway", suburb: "Gordon", state: "NSW", postcode: "2072" }, phone: "02 9424 0000", fax: "02 9424 0001", email: "krg@krg.nsw.gov.au", suburbs: ["Gordon", "Turramurra", "Pymble", "Wahroonga", "Lindfield", "Roseville", "St Ives", "Killara", "North Turramurra", "South Turramurra", "West Pymble", "East Killara", "North Wahroonga", "Warrawee"] },
  { name: "Lane Cove Council", address: { streetNumber: "48", street: "Longueville Road", suburb: "Lane Cove", state: "NSW", postcode: "2066" }, phone: "02 9911 3555", fax: "02 9911 3600", email: "service@lanecove.nsw.gov.au", suburbs: ["Lane Cove", "Greenwich", "Longueville", "Riverview", "Northwood", "Lane Cove North", "Lane Cove West"] },
  { name: "Liverpool City Council", address: { streetNumber: "50", street: "Scott Street", suburb: "Liverpool", state: "NSW", postcode: "2170" }, phone: "1300 362 170", fax: "02 9821 9333", email: "lcc@liverpool.nsw.gov.au", suburbs: ["Liverpool", "Casula", "Moorebank", "Chipping Norton", "Hoxton Park", "Green Valley", "Cecil Hills", "Prestons", "Wattle Grove", "Warwick Farm", "Lurnea", "Ashcroft", "Busby", "Heckenberg", "Sadleir", "Miller", "Cartwright", "Hinchinbrook", "West Hoxton", "Middleton Grange", "Carnes Hill", "Horningsea Park", "Denham Court", "Edmondson Park", "Austral", "Leppington", "Rossmore", "Bringelly", "Kemps Creek", "Badgerys Creek", "Voyager Point", "Pleasure Point", "Sandy Point", "Holsworthy"] },
  { name: "Mosman Council", address: { streetNumber: "573", street: "Military Road", suburb: "Spit Junction", state: "NSW", postcode: "2088" }, phone: "02 9978 4000", fax: "02 9978 4132", email: "council@mosman.nsw.gov.au", suburbs: ["Mosman", "Balmoral", "Spit Junction", "Beauty Point", "Clifton Gardens", "Georges Heights"] },
  { name: "North Sydney Council", address: { streetNumber: "200", street: "Miller Street", suburb: "North Sydney", state: "NSW", postcode: "2060" }, phone: "02 9936 8100", fax: "02 9936 8177", email: "council@northsydney.nsw.gov.au", suburbs: ["North Sydney", "Cammeray", "Cremorne", "Neutral Bay", "Kirribilli", "Waverton", "McMahons Point", "Crows Nest", "Wollstonecraft", "St Leonards", "Lavender Bay", "Milsons Point", "Cremorne Point", "Kurraba Point"] },
  { name: "Northern Beaches Council", address: { streetNumber: "725", street: "Pittwater Road", suburb: "Dee Why", state: "NSW", postcode: "2099" }, phone: "1300 434 434", fax: "", email: "council@northernbeaches.nsw.gov.au", suburbs: ["Dee Why", "Manly", "Mona Vale", "Narrabeen", "Brookvale", "Warriewood", "Avalon", "Frenchs Forest", "Freshwater", "Collaroy", "Avalon Beach", "Newport", "Curl Curl", "Cromer", "Belrose", "Forestville", "Beacon Hill", "Balgowlah", "Seaforth", "Fairlight", "Queenscliff", "Palm Beach", "Bilgola", "Elanora Heights", "Terrey Hills", "Duffys Forest", "Ingleside"] },
  { name: "City of Parramatta Council", address: { streetNumber: "126", street: "Church Street", suburb: "Parramatta", state: "NSW", postcode: "2150" }, phone: "1300 617 058", fax: "02 9806 5917", email: "council@cityofparramatta.nsw.gov.au", suburbs: ["Parramatta", "Harris Park", "Rosehill", "North Parramatta", "Northmead", "Westmead", "Dundas", "Telopea", "Camellia", "Rydalmere", "Dundas Valley", "Oatlands", "North Rocks", "Carlingford", "Constitution Hill", "Epping", "Ermington", "Melrose Park", "Newington", "Silverwater", "Wentworth Point", "Sydney Olympic Park"] },
  { name: "Penrith City Council", address: { streetNumber: "601", street: "High Street", suburb: "Penrith", state: "NSW", postcode: "2750" }, phone: "02 4732 7777", fax: "02 4732 7958", email: "council@penrith.city", suburbs: ["Penrith", "Kingswood", "St Marys", "Emu Plains", "Cambridge Park", "Werrington", "Glenmore Park", "Jamisontown", "Cranebrook", "South Penrith", "Colyton", "Oxley Park", "North St Marys", "Erskine Park", "St Clair", "Claremont Meadows", "Llandilo", "Londonderry", "Castlereagh", "Mulgoa", "Regentville", "Leonay", "Werrington County", "Werrington Downs", "Cambridge Gardens", "Jordan Springs", "Caddens", "Orchard Hills", "Wallacia", "Luddenham", "Agnes Banks"] },
  { name: "Randwick City Council", address: { streetNumber: "30", street: "Frances Street", suburb: "Randwick", state: "NSW", postcode: "2031" }, phone: "1300 722 542", fax: "02 9319 1510", email: "council@randwick.nsw.gov.au", suburbs: ["Randwick", "Coogee", "Kensington", "Kingsford", "Maroubra", "Malabar", "Matraville", "Clovelly", "South Coogee", "Centennial Park"] },
  { name: "City of Ryde Council", address: { streetNumber: "1", street: "Pope Street", suburb: "Ryde", state: "NSW", postcode: "2112" }, phone: "02 9952 8222", fax: "02 9952 8070", email: "cityofryde@ryde.nsw.gov.au", suburbs: ["Ryde", "Eastwood", "Meadowbank", "West Ryde", "Marsfield", "North Ryde", "Denistone", "East Ryde", "Putney", "Tennyson Point", "Gladesville", "Macquarie Park"] },
  { name: "Strathfield Council", address: { streetNumber: "65", street: "Homebush Road", suburb: "Strathfield", state: "NSW", postcode: "2135" }, phone: "02 9748 9999", fax: "02 9764 1034", email: "council@strathfield.nsw.gov.au", suburbs: ["Strathfield", "Homebush", "Homebush West", "Strathfield South", "Flemington"] },
  { name: "Sutherland Shire Council", address: { streetNumber: "4-20", street: "Eton Street", suburb: "Sutherland", state: "NSW", postcode: "2232" }, phone: "02 9710 0333", fax: "02 9710 0265", email: "ssc@ssc.nsw.gov.au", suburbs: ["Sutherland", "Cronulla", "Miranda", "Caringbah", "Menai", "Engadine", "Gymea", "Kirrawee", "Jannali", "Sylvania", "Illawong", "Bangor", "Barden Ridge", "Woronora", "Como", "Oyster Bay", "Taren Point", "Sylvania Waters", "Yowie Bay", "Dolans Bay", "Burraneer", "Woolooware", "Greenhills Beach", "Kareela", "Loftus", "Heathcote", "Waterfall", "Bundeena", "Grays Point"] },
  { name: "City of Sydney Council", address: { streetNumber: "456", street: "Kent Street", suburb: "Sydney", state: "NSW", postcode: "2000" }, phone: "02 9265 9333", fax: "02 9265 9222", email: "council@cityofsydney.nsw.gov.au", suburbs: ["Sydney", "Pyrmont", "Ultimo", "Surry Hills", "Redfern", "Darlinghurst", "Chippendale", "Zetland", "Glebe", "Waterloo", "Alexandria", "Rosebery", "Potts Point", "Woolloomooloo", "Haymarket", "Barangaroo", "Millers Point", "Beaconsfield", "Eveleigh", "Darlington", "Forest Lodge", "Elizabeth Bay", "Rushcutters Bay"] },
  { name: "The Hills Shire Council", address: { streetNumber: "3", street: "Columbia Court", suburb: "Norwest", state: "NSW", postcode: "2153" }, phone: "02 9843 0555", fax: "02 9843 0409", email: "council@thehills.nsw.gov.au", suburbs: ["Castle Hill", "Baulkham Hills", "Kellyville", "Rouse Hill", "Bella Vista", "Norwest", "Winston Hills", "Beaumont Hills", "Glenhaven", "Dural", "Annangrove", "Kenthurst", "Box Hill", "West Pennant Hills"] },
  { name: "Waverley Council", address: { streetNumber: "55", street: "Spring Street", suburb: "Bondi Junction", state: "NSW", postcode: "2022" }, phone: "02 9083 8000", fax: "", email: "info@waverley.nsw.gov.au", suburbs: ["Bondi", "Bondi Junction", "Bronte", "Tamarama", "Queens Park", "North Bondi", "Bondi Beach", "Waverley", "Dover Heights"] },
  { name: "Willoughby City Council", address: { streetNumber: "31-37", street: "Victor Street", suburb: "Chatswood", state: "NSW", postcode: "2067" }, phone: "02 9777 1000", fax: "", email: "email@willoughby.nsw.gov.au", suburbs: ["Chatswood", "Willoughby", "Naremburn", "Castlecrag", "Northbridge", "Artarmon", "Middle Cove", "Castle Cove", "Chatswood West"] },
  { name: "Wollondilly Shire Council", address: { streetNumber: "62-64", street: "Menangle Street", suburb: "Picton", state: "NSW", postcode: "2571" }, phone: "02 4677 1100", fax: "", email: "council@wollondilly.nsw.gov.au", suburbs: ["Picton", "Tahmoor", "Bargo", "Thirlmere", "Appin", "Douglas Park", "The Oaks", "Warragamba", "Silverdale", "Menangle", "Yanderra"] },
  { name: "Woollahra Municipal Council", address: { streetNumber: "536", street: "New South Head Road", suburb: "Double Bay", state: "NSW", postcode: "2028" }, phone: "02 9391 7000", fax: "02 9391 7044", email: "records@woollahra.nsw.gov.au", suburbs: ["Double Bay", "Woollahra", "Vaucluse", "Rose Bay", "Watsons Bay", "Bellevue Hill", "Point Piper", "Edgecliff", "Darling Point", "Paddington"] },
  { name: "Central Coast Council", address: { streetNumber: "2", street: "Hely Street", suburb: "Wyong", state: "NSW", postcode: "2259" }, phone: "02 4306 7900", fax: "", email: "ask@centralcoast.nsw.gov.au", suburbs: ["Wyong", "Gosford", "Terrigal", "Tuggerah", "Erina", "The Entrance", "Woy Woy", "Umina Beach", "Bateau Bay", "Long Jetty", "Killarney Vale", "Berkeley Vale", "Wyoming", "Narara", "Lisarow", "Ourimbah", "Kariong", "Point Clare", "East Gosford", "Green Point", "Avoca Beach", "Copacabana", "Wamberal", "Bensville", "Empire Bay", "Ettalong Beach", "Blackwall", "Toukley", "Budgewoi", "San Remo", "Lake Munmorah", "Doyalson", "Warnervale", "Hamlyn Terrace", "Wadalba", "Kanwal", "Gorokan", "Lake Haven"] },
  { name: "Wollongong City Council", address: { streetNumber: "41", street: "Burelli Street", suburb: "Wollongong", state: "NSW", postcode: "2500" }, phone: "02 4227 7111", fax: "02 4227 7277", email: "council@wollongong.nsw.gov.au", suburbs: ["Wollongong", "Fairy Meadow", "Corrimal", "Dapto", "Figtree", "Thirroul", "Bulli", "Port Kembla", "Woonona", "Bellambi", "Russell Vale", "Balgownie", "Mount Ousley", "Keiraville", "Gwynneville", "West Wollongong", "Mangerton", "Coniston", "Unanderra", "Berkeley", "Warrawong", "Windang", "Primbee", "Cordeaux Heights", "Farmborough Heights", "Kanahooka", "Koonawarra", "Horsley", "Austinmer", "Coledale", "Scarborough", "Helensburgh", "Stanwell Park", "Otford"] },
];

// Picks Lot/Section/DP out of an address when the certifier pastes it in
// directly (e.g. "Lot 12 Section 3 DP123456, 45 Smith Street, Suburb NSW"),
// normalised to match the "Lot/Section/DP" field's own format.
// A lot identifier is not always a number — NSW parcels are routinely
// lettered ("A/-/DP370654"), so anything alphanumeric counts. The plan
// number that follows is what makes the match unambiguous.
const LOT_DP_RE = /lot\s*([0-9a-z]{1,6})(?:\s*,?\s*sec(?:tion)?\s*([0-9a-z]+))?\s*,?\s*(?:in\s*)?(dp|sp)\s*(\d+)/i;
export function extractLotDpFromAddress(addressText: string): string | null {
  if (!addressText) return null;
  const m = addressText.match(LOT_DP_RE);
  if (!m) return null;
  const [, lot, section, plan, planNo] = m;
  return `${lot.toUpperCase()}/${section ? section.toUpperCase() : "-"}/${plan.toUpperCase()}${planNo}`;
}

// Finds the council whose suburb the address names.
//
// Matches on whole words and keeps the *longest* suburb that fits, which
// is what makes "12 Smith St, Bondi Junction" resolve to Bondi Junction
// rather than to Bondi simply because Bondi appears earlier in the list.
// A suburb that sits across two LGAs is deliberately absent from the
// directory rather than assigned to a guess — naming the wrong consent
// authority on a certificate is worse than leaving the field blank.
export function matchCouncilByAddress(addressText: string) {
  if (!addressText) return null;
  const normalized = ` ${addressText.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;

  let best: { council: (typeof COUNCIL_DIRECTORY)[number]; length: number } | null = null;
  for (const council of COUNCIL_DIRECTORY) {
    for (const suburb of council.suburbs || []) {
      const needle = ` ${suburb.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
      if (normalized.includes(needle) && (!best || needle.length > best.length)) {
        best = { council, length: needle.length };
      }
    }
  }
  return best?.council || null;
}

export function defaultScopeOfWorks(pathway: "CDC" | "CC") {
  const certName = pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate";
  return [
    "BCA Assessment",
    "SEPP Assessment",
    `Determination of ${certName}`,
    "Carrying out All Mandatory Inspections",
    "Occupation Certificate Assessment",
    "Determination of an Occupation Certificate",
  ];
}
