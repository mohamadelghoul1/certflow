import { useState, useRef } from "react";
import {
  Search,
  ClipboardCheck,
  CalendarCheck,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  ArrowLeft,
  Plus,
  X,
  Check,
  UploadCloud,
  AlertTriangle,
  Info,
  Pencil,
  Lock,
  Mail,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Reference libraries
// ---------------------------------------------------------------------------

const DOC_LIBRARY = {
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

const MANDATORY_CRITICAL_STAGE_INSPECTIONS = [
  { no: 1, stage: "After excavation for and prior to placement of any footings", inspector: "Registered Certifier & Structural Engineer" },
  { no: 2, stage: "Prior to pouring any in-situ reinforced concrete building element", inspector: "Registered Certifier & Structural Engineer" },
  { no: 3, stage: "Prior to covering of the framework for any floor, wall, roof, or other building element", inspector: "Registered Certifier & Structural Engineer" },
  { no: 4, stage: "Prior to covering waterproofing in any wet areas", inspector: "Registered Certifier" },
  { no: 5, stage: "Prior to covering any stormwater drainage connections", inspector: "Registered Certifier" },
  { no: 6, stage: "After the building work has been completed & prior to any Occupation Certificate being issued in relation to the building", inspector: "Principal Certifier" },
];

const INSPECTION_LIBRARY = [
  { title: "Prior to CC/CDC", desc: "Site inspection prior to issue of CC or CDC." },
  { title: "Piers & Footings", desc: "Inspection of piers and footings prior to pour." },
  { title: "Slab Steel", desc: "Inspection of slab reinforcement prior to pour." },
  { title: "Frame", desc: "Inspection of structural frame prior to lock-up." },
  { title: "Waterproofing", desc: "Inspection of wet area waterproofing." },
  { title: "Stormwater", desc: "Inspection of stormwater drainage installation." },
  { title: "Final", desc: "Final inspection prior to occupation." },
];

const JOB_TYPES = ["Secondary Dwelling", "Dual Occupancy", "Alterations & Additions", "New Dwelling", "Pool"];
const BCA_VERSIONS = ["NCC 2022", "NCC 2025", "BCA 2019 Amendment 1"];
const BUILDING_CLASSIFICATIONS = [
  "Class 1a — Single dwelling",
  "Class 1b — Boarding house / B&B",
  "Class 2 — Apartments",
  "Class 10a — Non-habitable (garage, shed, carport)",
  "Class 10b — Structure (pool, fence, retaining wall)",
];
const CONSTRUCTION_TYPES = ["N/A", "Type A", "Type B", "Type C"];
const NSW_STATE = ["NSW", "ACT", "QLD", "VIC"];

// Parts of the State Environmental Planning Policy (Exempt and Complying
// Development Codes) 2008 — only relevant to CDC. Ticking one or more here
// generates the correct legislative reference automatically, instead of
// typing it out by hand.
const SEPP_CODE_PARTS = [
  "Part 1", "Part 2", "Part 2A", "Part 3", "Part 3A", "Part 3B", "Part 3BA", "Part 3C", "Part 3D",
  "Part 4", "Part 4A", "Part 5", "Part 5A", "Part 5B", "Part 6", "Part 7", "Part 8",
  "Schedule One Complying Development Secondary Dwelling",
];
const SEPP_CODES_2008_NAME = "State Environmental Planning Policy (Exempt and Complying Development Codes) 2008";
const SEPP_HOUSING_2021_NAME = "State Environmental Planning Policy (Housing) 2021";
// Most Parts sit under the 2008 Codes SEPP — but Secondary Dwelling complying
// development actually sits under the Housing SEPP instead.
const CODE_PART_EPI_OVERRIDES = {
  "Schedule One Complying Development Secondary Dwelling": SEPP_HOUSING_2021_NAME,
};
function epiForCodeParts(parts) {
  const names = new Set();
  parts.forEach((p) => names.add(CODE_PART_EPI_OVERRIDES[p] || SEPP_CODES_2008_NAME));
  return [...names].join(" & ");
}

// Council directory — every council across Greater Sydney (33 LGAs, which
// includes Wollondilly), plus Central Coast and Wollongong, sourced from the
// NSW Local Government Directory. Selecting one auto-fills its address and
// contact details; anything not listed here still works as free text.
const COUNCIL_DIRECTORY = [
  { name: "Bayside Council", address: { streetNumber: "444-446", street: "Princes Highway", suburb: "Rockdale", state: "NSW", postcode: "2216" }, phone: "02 9562 1666", fax: "", email: "council@bayside.nsw.gov.au" , suburbs: ["Rockdale", "Brighton-Le-Sands", "Kogarah", "Bexley", "Arncliffe", "Banksia", "Mascot", "Botany", "Eastlakes", "Pagewood"] },
  { name: "Blacktown City Council", address: { streetNumber: "62", street: "Flushcombe Road", suburb: "Blacktown", state: "NSW", postcode: "2148" }, phone: "02 9839 6000", fax: "02 9831 1961", email: "council@blacktown.nsw.gov.au" , suburbs: ["Blacktown", "Mount Druitt", "Rooty Hill", "Doonside", "Seven Hills", "Marayong", "Quakers Hill", "Glenwood", "Stanhope Gardens", "Riverstone", "Schofields"] },
  { name: "Blue Mountains City Council", address: { streetNumber: "2", street: "Civic Place", suburb: "Katoomba", state: "NSW", postcode: "2780" }, phone: "02 4780 5000", fax: "02 4780 5555", email: "council@bmcc.nsw.gov.au" , suburbs: ["Katoomba", "Springwood", "Leura", "Blaxland", "Glenbrook", "Lawson", "Wentworth Falls", "Mount Victoria"] },
  { name: "Burwood Council", address: { streetNumber: "2", street: "Conder Street", suburb: "Burwood", state: "NSW", postcode: "2134" }, phone: "02 9911 9911", fax: "02 9911 9900", email: "council@burwood.nsw.gov.au" , suburbs: ["Burwood", "Croydon", "Burwood Heights", "Enfield"] },
  { name: "Camden Council", address: { streetNumber: "70", street: "Central Avenue", suburb: "Oran Park", state: "NSW", postcode: "2570" }, phone: "02 4654 7777", fax: "02 4654 7829", email: "mail@camden.nsw.gov.au" , suburbs: ["Camden", "Oran Park", "Narellan", "Mount Annan", "Elderslie", "Harrington Park", "Currans Hill"] },
  { name: "Campbelltown City Council", address: { streetNumber: "", street: "Civic Centre, Cnr Queen & Broughton Streets", suburb: "Campbelltown", state: "NSW", postcode: "2560" }, phone: "02 4645 4000", fax: "02 4645 4111", email: "council@campbelltown.nsw.gov.au" , suburbs: ["Campbelltown", "Ingleburn", "Minto", "Raby", "Airds", "Rosemeadow", "Claymore", "Glen Alpine", "Leumeah"] },
  { name: "City of Canada Bay Council", address: { streetNumber: "1A", street: "Marlborough Street", suburb: "Drummoyne", state: "NSW", postcode: "2047" }, phone: "02 9911 6555", fax: "02 9911 6550", email: "council@canadabay.nsw.gov.au" , suburbs: ["Drummoyne", "Concord", "Five Dock", "Rodd Point", "Russell Lea", "Abbotsford", "Chiswick"] },
  { name: "Canterbury-Bankstown Council", address: { streetNumber: "66-72", street: "Rickard Road", suburb: "Bankstown", state: "NSW", postcode: "2200" }, phone: "02 9707 9000", fax: "02 9707 9700", email: "council@cbcity.nsw.gov.au" , suburbs: ["Bankstown", "Canterbury", "Campsie", "Punchbowl", "Lakemba", "Belmore", "Roselands", "Padstow", "Panania", "Revesby"] },
  { name: "Cumberland Council", address: { streetNumber: "16", street: "Memorial Avenue", suburb: "Merrylands", state: "NSW", postcode: "2160" }, phone: "02 8757 9000", fax: "02 9840 9734", email: "council@cumberland.nsw.gov.au" , suburbs: ["Merrylands", "Granville", "Auburn", "Lidcombe", "Guildford", "Greystanes", "Wentworthville", "South Wentworthville", "Regents Park"] },
  { name: "Fairfield City Council", address: { streetNumber: "86", street: "Avoca Road", suburb: "Wakeley", state: "NSW", postcode: "2176" }, phone: "02 9725 0222", fax: "02 9725 4249", email: "mail@fairfieldcity.nsw.gov.au" , suburbs: ["Fairfield", "Cabramatta", "Wakeley", "Bonnyrigg", "Canley Heights", "Canley Vale", "Prairiewood", "Smithfield", "Villawood", "Yennora", "Fairfield West", "St Johns Park"] },
  { name: "Georges River Council", address: { streetNumber: "", street: "Georges River Civic Centre, Cnr MacMahon and Dora Streets", suburb: "Hurstville", state: "NSW", postcode: "2220" }, phone: "02 9330 6400", fax: "", email: "mail@georgesriver.nsw.gov.au" , suburbs: ["Hurstville", "Penshurst", "Mortdale", "Peakhurst", "Oatley", "Beverly Hills", "Riverwood", "South Hurstville"] },
  { name: "Hawkesbury City Council", address: { streetNumber: "366", street: "George Street", suburb: "Windsor", state: "NSW", postcode: "2756" }, phone: "02 4560 4444", fax: "02 4587 7740", email: "council@hawkesbury.nsw.gov.au" , suburbs: ["Windsor", "Richmond", "Kurrajong", "North Richmond", "Wilberforce", "Pitt Town"] },
  { name: "Hornsby Shire Council", address: { streetNumber: "296", street: "Peats Ferry Road", suburb: "Hornsby", state: "NSW", postcode: "2077" }, phone: "02 9847 6666", fax: "02 9847 6999", email: "hsc@hornsby.nsw.gov.au" , suburbs: ["Hornsby", "Waitara", "Asquith", "Berowra", "Mount Colah", "Mount Kuring-gai", "Pennant Hills", "Cherrybrook", "Thornleigh"] },
  { name: "Hunter's Hill Council", address: { streetNumber: "22", street: "Alexandra Street", suburb: "Hunters Hill", state: "NSW", postcode: "2110" }, phone: "02 9879 9400", fax: "", email: "customerservice@huntershill.nsw.gov.au" , suburbs: ["Hunters Hill", "Woolwich", "Boronia Park"] },
  { name: "Inner West Council", address: { streetNumber: "260", street: "Liverpool Road", suburb: "Ashfield", state: "NSW", postcode: "2131" }, phone: "02 9392 5000", fax: "02 9392 5911", email: "council@innerwest.nsw.gov.au" , suburbs: ["Ashfield", "Leichhardt", "Marrickville", "Balmain", "Newtown", "Petersham", "Summer Hill", "Dulwich Hill", "Annandale", "Rozelle"] },
  { name: "Ku-ring-gai Council", address: { streetNumber: "818", street: "Pacific Highway", suburb: "Gordon", state: "NSW", postcode: "2072" }, phone: "02 9424 0000", fax: "02 9424 0001", email: "krg@krg.nsw.gov.au" , suburbs: ["Gordon", "Turramurra", "Pymble", "Wahroonga", "Lindfield", "Roseville", "St Ives", "Killara"] },
  { name: "Lane Cove Council", address: { streetNumber: "48", street: "Longueville Road", suburb: "Lane Cove", state: "NSW", postcode: "2066" }, phone: "02 9911 3555", fax: "02 9911 3600", email: "service@lanecove.nsw.gov.au" , suburbs: ["Lane Cove", "Greenwich", "Longueville", "Riverview", "Northwood"] },
  { name: "Liverpool City Council", address: { streetNumber: "50", street: "Scott Street", suburb: "Liverpool", state: "NSW", postcode: "2170" }, phone: "1300 362 170", fax: "02 9821 9333", email: "lcc@liverpool.nsw.gov.au" , suburbs: ["Liverpool", "Casula", "Moorebank", "Chipping Norton", "Hoxton Park", "Green Valley", "Cecil Hills", "Prestons", "Wattle Grove"] },
  { name: "Mosman Council", address: { streetNumber: "573", street: "Military Road", suburb: "Spit Junction", state: "NSW", postcode: "2088" }, phone: "02 9978 4000", fax: "02 9978 4132", email: "council@mosman.nsw.gov.au" , suburbs: ["Mosman", "Balmoral", "Spit Junction", "Beauty Point"] },
  { name: "North Sydney Council", address: { streetNumber: "200", street: "Miller Street", suburb: "North Sydney", state: "NSW", postcode: "2060" }, phone: "02 9936 8100", fax: "02 9936 8177", email: "council@northsydney.nsw.gov.au" , suburbs: ["North Sydney", "Cammeray", "Cremorne", "Neutral Bay", "Kirribilli", "Waverton", "McMahons Point"] },
  { name: "Northern Beaches Council", address: { streetNumber: "725", street: "Pittwater Road", suburb: "Dee Why", state: "NSW", postcode: "2099" }, phone: "1300 434 434", fax: "", email: "council@northernbeaches.nsw.gov.au" , suburbs: ["Dee Why", "Manly", "Mona Vale", "Narrabeen", "Brookvale", "Warriewood", "Avalon", "Frenchs Forest", "Freshwater", "Collaroy"] },
  { name: "City of Parramatta Council", address: { streetNumber: "126", street: "Church Street", suburb: "Parramatta", state: "NSW", postcode: "2150" }, phone: "1300 617 058", fax: "02 9806 5917", email: "council@cityofparramatta.nsw.gov.au" , suburbs: ["Parramatta", "Harris Park", "Rosehill", "North Parramatta", "Northmead", "Westmead", "Dundas", "Telopea"] },
  { name: "Penrith City Council", address: { streetNumber: "601", street: "High Street", suburb: "Penrith", state: "NSW", postcode: "2750" }, phone: "02 4732 7777", fax: "02 4732 7958", email: "council@penrith.city" , suburbs: ["Penrith", "Kingswood", "St Marys", "Emu Plains", "Cambridge Park", "Werrington", "Glenmore Park", "Jamisontown", "Cranebrook"] },
  { name: "Randwick City Council", address: { streetNumber: "30", street: "Frances Street", suburb: "Randwick", state: "NSW", postcode: "2031" }, phone: "1300 722 542", fax: "02 9319 1510", email: "council@randwick.nsw.gov.au" , suburbs: ["Randwick", "Coogee", "Kensington", "Kingsford", "Maroubra", "Malabar", "Matraville", "Clovelly"] },
  { name: "City of Ryde Council", address: { streetNumber: "1", street: "Pope Street", suburb: "Ryde", state: "NSW", postcode: "2112" }, phone: "02 9952 8222", fax: "02 9952 8070", email: "cityofryde@ryde.nsw.gov.au" , suburbs: ["Ryde", "Eastwood", "Meadowbank", "West Ryde", "Marsfield", "North Ryde", "Denistone"] },
  { name: "Strathfield Council", address: { streetNumber: "65", street: "Homebush Road", suburb: "Strathfield", state: "NSW", postcode: "2135" }, phone: "02 9748 9999", fax: "02 9764 1034", email: "council@strathfield.nsw.gov.au" , suburbs: ["Strathfield", "Homebush", "Homebush West", "Strathfield South"] },
  { name: "Sutherland Shire Council", address: { streetNumber: "4-20", street: "Eton Street", suburb: "Sutherland", state: "NSW", postcode: "2232" }, phone: "02 9710 0333", fax: "02 9710 0265", email: "ssc@ssc.nsw.gov.au" , suburbs: ["Sutherland", "Cronulla", "Miranda", "Caringbah", "Menai", "Engadine", "Gymea", "Kirrawee", "Jannali"] },
  { name: "City of Sydney Council", address: { streetNumber: "456", street: "Kent Street", suburb: "Sydney", state: "NSW", postcode: "2000" }, phone: "02 9265 9333", fax: "02 9265 9222", email: "council@cityofsydney.nsw.gov.au" , suburbs: ["Sydney", "Pyrmont", "Ultimo", "Surry Hills", "Redfern", "Darlinghurst", "Chippendale", "Zetland", "Glebe"] },
  { name: "The Hills Shire Council", address: { streetNumber: "3", street: "Columbia Court", suburb: "Norwest", state: "NSW", postcode: "2153" }, phone: "02 9843 0555", fax: "02 9843 0409", email: "council@thehills.nsw.gov.au" , suburbs: ["Castle Hill", "Baulkham Hills", "Kellyville", "Rouse Hill", "Bella Vista", "Norwest", "Winston Hills", "Beaumont Hills"] },
  { name: "Waverley Council", address: { streetNumber: "55", street: "Spring Street", suburb: "Bondi Junction", state: "NSW", postcode: "2022" }, phone: "02 9083 8000", fax: "", email: "info@waverley.nsw.gov.au" , suburbs: ["Bondi", "Bondi Junction", "Bronte", "Tamarama", "Bellevue Hill", "Queens Park", "North Bondi"] },
  { name: "Willoughby City Council", address: { streetNumber: "31-37", street: "Victor Street", suburb: "Chatswood", state: "NSW", postcode: "2067" }, phone: "02 9777 1000", fax: "", email: "email@willoughby.nsw.gov.au" , suburbs: ["Chatswood", "Willoughby", "Naremburn", "Castlecrag", "Northbridge", "Artarmon"] },
  { name: "Wollondilly Shire Council", address: { streetNumber: "62-64", street: "Menangle Street", suburb: "Picton", state: "NSW", postcode: "2571" }, phone: "02 4677 1100", fax: "", email: "council@wollondilly.nsw.gov.au" , suburbs: ["Picton", "Tahmoor", "Bargo", "Thirlmere", "Appin", "Douglas Park"] },
  { name: "Woollahra Municipal Council", address: { streetNumber: "536", street: "New South Head Road", suburb: "Double Bay", state: "NSW", postcode: "2028" }, phone: "02 9391 7000", fax: "02 9391 7044", email: "records@woollahra.nsw.gov.au" , suburbs: ["Double Bay", "Woollahra", "Vaucluse", "Rose Bay", "Watsons Bay"] },
  { name: "Central Coast Council", address: { streetNumber: "2", street: "Hely Street", suburb: "Wyong", state: "NSW", postcode: "2259" }, phone: "02 4306 7900", fax: "", email: "ask@centralcoast.nsw.gov.au" , suburbs: ["Wyong", "Gosford", "Terrigal", "Tuggerah", "Erina", "The Entrance", "Woy Woy", "Umina Beach"] },
  { name: "Wollongong City Council", address: { streetNumber: "41", street: "Burelli Street", suburb: "Wollongong", state: "NSW", postcode: "2500" }, phone: "02 4227 7111", fax: "02 4227 7277", email: "council@wollongong.nsw.gov.au" , suburbs: ["Wollongong", "Fairy Meadow", "Corrimal", "Dapto", "Figtree", "Thirroul", "Bulli", "Port Kembla"] },
];
// Best-effort suburb → council match. Coverage is a curated set of
// well-known suburbs per council, not exhaustive across all ~700+ NSW
// suburbs — always double-check and override manually if it guesses wrong.
function matchCouncilByAddress(addressText) {
  if (!addressText) return null;
  const normalized = addressText.toLowerCase();
  for (const council of COUNCIL_DIRECTORY) {
    for (const suburb of council.suburbs || []) {
      if (normalized.includes(suburb.toLowerCase())) return council;
    }
  }
  return null;
}

const VALID_FOR_OPTIONS = ["7 Days", "14 Days", "30 Days", "60 Days"];
const QUOTE_STATUS_META = {
  draft: { label: "Draft", style: "bg-slate-100 text-slate-600" },
  sent: { label: "Sent", style: "bg-blue-50 text-blue-700" },
  accepted: { label: "Accepted", style: "bg-emerald-50 text-emerald-700" },
  declined: { label: "Declined", style: "bg-red-50 text-red-700" },
};

// Certifying firm letterhead — used to generate certificate documents
const FIRM = {
  name: "QUALITY PRIVATE CERTIFIERS",
  abn: "41 630 945 416",
  postal: "PO BOX 195, Blaxcell NSW 2142",
  office: "Suite 2/F1 101 Rookwood Road, Yagoona NSW 2199",
  phone: "0404 940 898",
  email: "info@qpcertifiers.com.au",
  website: "www.qpcertifiers.com.au",
  certifierName: "Mohamad El Ghoul",
  certifierRego: "BDC2961",
  certifierBody: "Building Commission NSW",
};

// The firm's default certifier is always certifier #1 — additional certifiers
// can be added under Settings and chosen per certificate/inspection.
function defaultCertifiers() {
  return [{ id: uid(), name: FIRM.certifierName, registrationNo: FIRM.certifierRego, registrationBody: FIRM.certifierBody, signatureUrl: "", piInsuranceExpiry: "", registrationExpiry: "" }];
}

// A reusable contact (architect, builder, or owner) who can be assigned to
// one or more jobs, so they see all their jobs together in the client
// portal instead of needing a separate login per job.
const CLIENT_TYPES = ["Architect", "Builder", "Owner", "Other"];
function makeClient({ name, type, company, email, phone }) {
  return { id: uid(), name, type: type || "Other", company: company || "", email: email || "", phone: phone || "" };
}
function clientLabel(c) {
  return c ? `${c.name} (${c.type})` : "";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function today() {
  return new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function formatISODate(iso) {
  if (!iso) return "Not yet scheduled";
  const dt = new Date(`${iso}T00:00:00`);
  if (isNaN(dt)) return iso;
  return dt.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}
function stageComplete(items) {
  return items.length > 0 && items.every((i) => i.status === "approved");
}
function unresolvedCount(item) {
  return (item.amendments || []).filter((a) => !a.resolved).length;
}
function displayStatus(item) {
  const n = unresolvedCount(item);
  if (item.status === "requested") return { dot: "bg-slate-300", label: "Requested" };
  if (n > 0) return { dot: "bg-amber-500", label: `Amendment needed (${n})` };
  if (item.status === "approved") return { dot: "bg-emerald-600", label: "Approved" };
  return { dot: "bg-blue-500", label: "Submitted — awaiting review" };
}

// Standard scope of works for a full CDC/CC + Principal Certifier engagement
// — the certifier can freely edit this list per quote; this is just the
// sensible starting point.
function defaultScopeOfWorks(pathway) {
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

function emptyQuote() {
  return {
    id: uid(),
    state: "NSW",
    projectType: "",
    pathway: "CDC",
    requiredStartDate: "",
    requiredEndDate: "",
    validFor: "7 Days",
    proposalAddress: "",
    lotSectionPlan: "",
    projectTitle: "",
    certifier: FIRM.certifierName,
    classifications: [],
    developmentDescription: "",
    ownerIsApplicant: true,
    applicant: { name: "", phone: "", email: "", address: { streetNumber: "", street: "", suburb: "", state: "NSW", postcode: "" } },
    owner: { name: "", phone: "", email: "" },
    councilLga: "",
    clientId: "",
    feeLines: [{ id: uid(), description: "CDC/PC/OC", quantity: "1", amount: "2500" }],
    scopeOfWorks: defaultScopeOfWorks("CDC"),
    status: "draft",
    paymentStatus: "unpaid", // "unpaid" | "paid" — manual tracking; see build brief for real Stripe collection
    paymentReceivedDate: "",
    termsOverride: "", // manually edited closing terms text, if the certifier has customised it
    linkedJobId: null,
  };
}

function emptyDetails() {
  return {
    projectNumber: "",
    zoning: "",
    bcaVersion: "",
    contact: { nameOrCompany: "", title: "", givenNames: "", surname: "", phone: "", fax: "", mobile: "", email: "" },
    applicantAddress: { streetNumber: "", street: "", suburb: "", state: "NSW", postcode: "" },
    ownerSameAsApplicant: true,
    owner: { name: "", address: { streetNumber: "", street: "", suburb: "", state: "NSW", postcode: "" }, phone: "" },
    council: {
      lga: "",
      address: { streetNumber: "", street: "", suburb: "", state: "NSW", postcode: "" },
      contact: { phone: "", fax: "", email: "" },
    },
    proposal: {
      classifications: [],
      constructionType: "N/A",
      dwellingsExisting: "",
      dwellingsDemolished: "",
      dwellingsNew: "",
      estimatedCost: "",
      storeysAbove: "",
      storeysBelow: "",
      storeysTotal: "",
      effectiveHeight: "",
      floorAreaExisting: "",
      floorAreaNew: "",
    },
    siteArea: "",
    buildingDescription: "",
    certificateDetails: {
      lotSectionDp: "",
      planningPortalRef: "",
      relevantInstrument: "",
      relevantPartOfCode: "",
      codeParts: [], // ticked SEPP 2008 code parts (CDC only) — drives the two fields above
      determinationDate: "",
      lapseDate: "",
    },
  };
}

function addYears(dateStr, years) {
  if (!dateStr) return "";
  const dt = new Date(dateStr);
  if (isNaN(dt)) return "";
  dt.setFullYear(dt.getFullYear() + years);
  return dt.toISOString().slice(0, 10);
}

// Inspection booking rules:
// - After 2pm, the earliest bookable day is 2 days out (not tomorrow).
// - Before 2pm, tomorrow is the earliest bookable day.
// - Any date landing on a Saturday or Sunday moves to the following
//   Tuesday specifically — not Monday.
function pushOffWeekend(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 6) d.setDate(d.getDate() + 3); // Saturday -> Tuesday
  else if (day === 0) d.setDate(d.getDate() + 2); // Sunday -> Tuesday
  return d;
}
function earliestBookableInspectionDate(now = new Date()) {
  const nowDay = now.getDay();
  // If the booking itself is being made during the weekend, Monday is never
  // offered — go straight to Tuesday, regardless of time of day.
  if (nowDay === 6 || nowDay === 0) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (nowDay === 6 ? 3 : 2)); // Sat -> Tue, Sun -> Tue
    return d;
  }
  const leadDays = now.getHours() >= 14 ? 2 : 1;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + leadDays);
  return pushOffWeekend(d);
}
function toISODateOnly(date) {
  return date.toISOString().slice(0, 10);
}
// A date is valid to book if it's on/after the earliest bookable day AND
// doesn't land on a weekend itself (weekend selections should be corrected
// to the Tuesday, not silently accepted).
function isValidInspectionBookingDate(isoDateStr, now = new Date()) {
  if (!isoDateStr) return false;
  const picked = new Date(isoDateStr + "T00:00:00");
  const day = picked.getDay();
  if (day === 0 || day === 6) return false;
  const earliest = earliestBookableInspectionDate(now);
  return picked >= earliest;
}
function suggestedInspectionBookingDate(isoDateStr, now = new Date()) {
  const earliest = earliestBookableInspectionDate(now);
  if (!isoDateStr) return toISODateOnly(earliest);
  const picked = new Date(isoDateStr + "T00:00:00");
  const adjusted = pushOffWeekend(picked < earliest ? earliest : picked);
  return toISODateOnly(adjusted);
}

// Always exactly 5 years from the Date of Determination. CDC only — CC has
// no lapse-date concept in this software.
function calcCdcLapseDate(project) {
  if (project.pathway !== "CDC") return "";
  const base = project.details.certificateDetails.determinationDate;
  if (!base) return "";
  return addYears(base, 5);
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDisplayDate(str) {
  if (!str) return null;
  const parts = str.split(" ");
  if (parts.length !== 3) return null;
  const [day, monStr, year] = parts;
  const month = MONTH_ABBR.indexOf(monStr);
  if (month === -1) return null;
  const dt = new Date(Number(year), month, Number(day));
  return isNaN(dt) ? null : dt;
}

// Every attributable action, derived from data already tracked against a
// named certifier — no separate action log needed for this. Real login
// (in the real build) would let this extend to document approvals too,
// which the prototype has no way to attribute to a specific person.
function buildAuditEvents(projects) {
  const events = [];
  for (const p of projects) {
    const pathRec = p.certificateRecords.pathway;
    if (pathRec.generated && pathRec.issuedBy) {
      events.push({ certifierName: pathRec.issuedBy.name, type: "cdc_cc", action: `Issued ${p.pathway} certificate`, project: p, date: pathRec.generatedDate });
    }
    pathRec.modifications.forEach((m, idx) => {
      if (m.generated && m.issuedBy) {
        events.push({ certifierName: m.issuedBy.name, type: "modification", action: `Issued Modification ${idx + 1} to ${p.pathway}`, project: p, date: m.generatedDate });
      }
    });
    ocRecords(p).forEach((r) => {
      if (r.issuedBy) {
        events.push({ certifierName: r.issuedBy.name, type: "oc", action: `Issued ${r.type === "whole" ? "Whole" : "Partial"} Occupation Certificate`, project: p, date: r.generatedDate });
      }
    });
    p.inspections.forEach((i) => {
      if (i.outcome !== "pending" && i.inspectorName) {
        const outcomeLabel = i.outcome === "passed" ? "Passed" : i.outcome === "failed" ? "Failed" : "Passed subject to conditions";
        events.push({ certifierName: i.inspectorName, type: "inspection", action: `Carried out inspection — ${i.title} (${outcomeLabel})`, project: p, date: formatISODate(i.date) });
      }
    });
  }
  return events;
}


function buildIssuanceEvents(projects) {
  const events = [];
  for (const p of projects) {
    const pathRec = p.certificateRecords.pathway;
    if (pathRec.generated) {
      const dt = parseDisplayDate(pathRec.generatedDate);
      if (dt) events.push({ type: p.pathway, date: dt, project: p });
    }
    const nocItems = p.checklists.NOC;
    if (stageComplete(nocItems)) {
      const dates = nocItems.map((i) => parseDisplayDate(i.date)).filter(Boolean);
      if (dates.length) events.push({ type: "NOC", date: new Date(Math.max(...dates)), project: p });
    }
    for (const rec of ocRecords(p)) {
      const dt = parseDisplayDate(rec.generatedDate);
      if (dt) events.push({ type: "OC", date: dt, project: p });
    }
  }
  return events;
}

function pathwayIssued(project) {
  return !!project.certificateRecords.pathway.generated;
}

function ocRecords(project) {
  return project.certificateRecords.oc.records;
}

// Which stage the job is actually at right now — used to scope client
// notifications to just the current application, not every stage at once.
function currentStage(project) {
  if (!pathwayIssued(project)) {
    return { key: project.pathway, label: `${project.pathway} Application`, items: project.checklists[project.pathway] };
  }
  if (!stageComplete(project.checklists.NOC)) {
    return { key: "NOC", label: "Notice of Commencement", items: project.checklists.NOC };
  }
  return { key: "OC", label: "Occupation Certificate", items: project.checklists.OC };
}

function hasWholeOC(project) {
  return ocRecords(project).some((r) => r.type === "whole");
}

function jobCertifierNames(project) {
  const names = new Set();
  if (project.certificateRecords.pathway.issuedBy) names.add(project.certificateRecords.pathway.issuedBy.name);
  for (const m of project.certificateRecords.pathway.modifications) if (m.issuedBy) names.add(m.issuedBy.name);
  for (const r of ocRecords(project)) if (r.issuedBy) names.add(r.issuedBy.name);
  return [...names];
}

// Downloads HTML content as a .doc file that opens directly in Microsoft Word,
// so the certifier can manually add or remove notations after generation.
function downloadAsWordDoc(filename, innerHtml) {
  const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>`;
  const footer = `</body></html>`;
  const blob = new Blob(["\ufeff", header + innerHtml + footer], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Opens the user's own email client pre-filled with the client's address,
// subject, and a summary body. Browsers can't attach files programmatically
// for security reasons, so this can't attach the exported doc automatically —
// the certifier attaches the just-downloaded Word/PDF file themselves before
// hitting send. A real "send with attachment" flow needs a backend email
// service (see build brief).
function buildQuoteMailto(quote, total) {
  const to = quote.applicant.email || "";
  const subject = `Fee Quote ${quote.id.toUpperCase()} — ${quote.proposalAddress || "Your project"}`;
  const body = [
    `Hi ${quote.applicant.name || "there"},`,
    "",
    `Please find attached our fee quote ${quote.id.toUpperCase()} for ${quote.proposalAddress || "your project"}.`,
    `Total (incl. GST): $${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    `This quote is valid for ${quote.validFor} from the date of issue.`,
    "",
    "Please attach the quote document (downloaded via Export as Word or Print/Save as PDF) before sending.",
    "",
    "Kind regards,",
    FIRM.certifierName,
    FIRM.name,
  ].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Builds one summary email covering everything since the last time the client
// was notified — deliberately not one email per approved item.
function buildJobUpdateMailto(project) {
  const d = project.details;
  const to = d.contact.email || "";
  const applicantName = d.contact.givenNames || d.contact.nameOrCompany || "Sir/Madam";
  const stage = currentStage(project);

  const done = stage.items.filter((i) => i.status === "approved").length;
  const total = stage.items.length;
  const openAmendments = stage.items.reduce((sum, i) => sum + unresolvedCount(i), 0);

  let statusLine = total > 0 ? `${done} of ${total} documents approved` : "No documents requested yet";
  if (openAmendments > 0) statusLine += ` — ${openAmendments} item${openAmendments === 1 ? "" : "s"} require your attention`;

  const subject = `${stage.label} Update – ${project.address}`;
  const body = [
    `Dear ${applicantName},`,
    "",
    `Please find below a summary of the current status of the ${stage.label} for your project at ${project.address}.`,
    "",
    statusLine,
    "",
    "Please log in to your client portal to review the details or upload any outstanding documents.",
    "",
    "Should you have any questions, please do not hesitate to contact our office.",
    "",
    "Kind regards,",
    FIRM.certifierName,
    FIRM.name,
  ].join("\n");

  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function inspectionsComplete(project) {
  return project.inspections.length > 0 && project.inspections.every((i) => i.outcome === "passed" || i.outcome === "passed_subject_to");
}

function effectiveLapseDate(project) {
  return calcCdcLapseDate(project);
}

// THE single source of truth for the CDC/CC reference number. Every
// document that shows this number — the certificate itself, the council
// letter, the applicant letter, the inspections notice, inspection reports
// — must call this same function, so the number can never drift between
// documents for the same job.
function pathwayCertRef(project) {
  const base = project.details.projectNumber || project.id.toUpperCase();
  const rec = project.certificateRecords.pathway;
  const version = rec.generated ? rec.version || 1 : 1;
  return `${project.pathway}-${base}/${String(version).padStart(2, "0")}`;
}

function makeProject({ address, description, types, pathway, certifierId, clientId, details }) {
  return {
    id: uid(),
    address,
    description,
    types: types || [],
    pathway,
    certifierId: certifierId || null,
    clientId: clientId || null, // the architect/builder/owner who can see this job in their portal
    sharedAccess: [], // additional people (e.g. the owner) granted access to just this job
    // which of the 6 standard mandatory critical stage inspections apply to
    // this job — defaults to all, since most jobs need all of them.
    criticalStageInspections: MANDATORY_CRITICAL_STAGE_INSPECTIONS.map((i) => i.no),
    councilLetterOverride: "", // manually edited letter text, if the certifier has customised it
    applicantLetterOverride: "",
    status: "active", // "active" | "complete"
    lastNotifiedAt: "", // date the client was last sent a summary update
    lastViewedAt: Date.now(),
    details: details || emptyDetails(),
    checklists: {
      [pathway]: DOC_LIBRARY[pathway].map((doc) => ({ ...doc, id: uid(), status: "requested", date: "Requested", amendments: [], version: 0, revision: "", documentDate: "", preparedBy: "", drawingNumber: "", clauseRef: "", requiresStamping: false, pendingReview: false })),
      NOC: DOC_LIBRARY.NOC.map((doc) => ({ ...doc, id: uid(), status: "requested", date: "Requested", amendments: [], version: 0, revision: "", documentDate: "", preparedBy: "", drawingNumber: "", clauseRef: "", requiresStamping: false, pendingReview: false })),
      OC: DOC_LIBRARY.OC.map((doc) => ({ ...doc, id: uid(), status: "requested", date: "Requested", amendments: [], version: 0, revision: "", documentDate: "", preparedBy: "", drawingNumber: "", clauseRef: "", requiresStamping: false, pendingReview: false })),
    },
    inspections: INSPECTION_LIBRARY.map((i) => ({ ...i, id: uid(), outcome: "pending", date: "", defects: [], photos: [], bookedByClient: false, confirmed: false, reportSent: false, reportSentDate: "", portalReported: false, portalReportedDate: "", inspectorName: FIRM.certifierName, inspectorLicense: FIRM.certifierRego })),
    conditions: [],
    // pathway: the original CDC/CC, plus any modification certificates issued against it.
    // oc: a list of issued Occupation Certificates — each is "partial" or "whole".
    // ("Final OC" is retired terminology; NSW now just uses partial/whole OC.)
    certificateRecords: {
      pathway: { generated: false, generatedDate: "", issuedBy: null, approvalUploaded: false, approvalDate: "", version: 0, modifications: [] },
      oc: { records: [] },
    },
  };
}

// Seed example jobs
const SEED_PROJECTS = [
  (() => {
    const p = makeProject({
      address: "159 Maud Street, Fairfield West NSW 2165",
      description: "Demolition of existing garage, awning & construction of a secondary dwelling with attached alfresco",
      types: ["Secondary Dwelling"],
      pathway: "CDC",
    });
    p.checklists.CDC = [
      { id: uid(), title: "CDC Application Form", desc: "Complete and lodge the CDC application.", status: "approved", date: "12 Jul 2026", amendments: [], revision: "-", documentDate: "12 Jul 2026", preparedBy: "JT Building Pty Ltd", drawingNumber: "", category: "Other", clauseRef: "", requiresStamping: false, version: 0 },
      {
        id: uid(),
        title: "Architectural Plans",
        desc: "Full set of architectural plans and elevations.",
        status: "submitted",
        date: "14 Jul 2026",
        revision: "B",
        documentDate: "13 Jul 2026",
        preparedBy: "Aria Design Studio",
        drawingNumber: "A03",
        category: "Architectural",
        version: 1,
        pendingReview: false,
        amendments: [
          { id: uid(), text: "Rear setback shown as 850mm — Housing Code requires 900mm minimum for a secondary dwelling on this lot. Please revise and resubmit.", date: "14 Jul 2026", resolved: false },
          { id: uid(), text: "Window sill height on the southern elevation isn't shown — add a detail confirming privacy screening compliance.", date: "14 Jul 2026", resolved: false },
        ],
      },
      { id: uid(), title: "Site Plan", desc: "Site plan showing setbacks, boundaries and existing structures.", status: "requested", date: "Requested", amendments: [], revision: "", documentDate: "", preparedBy: "", drawingNumber: "", category: "Architectural", clauseRef: "", requiresStamping: false, pendingReview: false, version: 0 },
    ];
    p.details = {
      ...emptyDetails(),
      projectNumber: "2264",
      zoning: "R2 Low Density Residential",
      bcaVersion: "NCC 2022",
      contact: { nameOrCompany: "JT Building Pty Ltd", title: "Mr", givenNames: "James", surname: "Tran", phone: "", fax: "", mobile: "0412 345 678", email: "james@jtbuilding.com.au" },
      applicantAddress: { streetNumber: "159", street: "Maud Street", suburb: "Fairfield West", state: "NSW", postcode: "2165" },
      council: { lga: "Fairfield City Council", address: { streetNumber: "86", street: "Court Road", suburb: "Fairfield", state: "NSW", postcode: "2165" }, contact: { phone: "02 9725 0222", fax: "", email: "council@fairfieldcity.nsw.gov.au" } },
      proposal: {
        classifications: ["Class 1a — Single dwelling", "Class 10a — Non-habitable (garage, shed, carport)"],
        constructionType: "Type C",
        dwellingsExisting: "1",
        dwellingsDemolished: "0",
        dwellingsNew: "1",
        estimatedCost: "185000",
        storeysAbove: "1",
        storeysBelow: "0",
        storeysTotal: "1",
        effectiveHeight: "4.2",
        floorAreaExisting: "140",
        floorAreaNew: "65",
      },
      siteArea: "620",
      buildingDescription: "Single storey secondary dwelling with attached alfresco, timber frame construction on concrete slab.",
      ownerSameAsApplicant: true,
      owner: { name: "", address: { streetNumber: "", street: "", suburb: "", state: "NSW", postcode: "" }, phone: "" },
      certificateDetails: {
        lotSectionDp: "12/-/DP12345",
        planningPortalRef: "CDC-331200",
        relevantInstrument: epiForCodeParts(["Part 7", "Schedule One Complying Development Secondary Dwelling"]),
        relevantPartOfCode: "Part 7, Schedule One Complying Development Secondary Dwelling",
        codeParts: ["Part 7", "Schedule One Complying Development Secondary Dwelling"],
        determinationDate: today(),
        lapseDate: "",
      },
    };
    p.conditions = [
      { id: uid(), text: "Any monetary contribution fees and/or Council fees/bonds required must be paid prior to commencement of building works. A receipt is to be sent to the PC.", dateAdded: "12 Jul 2026" },
      { id: uid(), text: "Any works on council property must have prior approval from Council, and a copy of such approval provided to the PC prior to works commencing.", dateAdded: "12 Jul 2026" },
    ];
    return p;
  })(),
  (() => {
    const p = makeProject({
      address: "2 Lombard Street, Fairfield West NSW 2165",
      description: "Construction of a two storey attached dual occupancy",
      types: ["Dual Occupancy"],
      pathway: "CC",
    });
    p.checklists.CC = DOC_LIBRARY.CC.map((d) => ({ ...d, id: uid(), status: "approved", date: "17 May 2018", amendments: [], revision: "A", documentDate: "10 May 2018", preparedBy: "Consulting Engineers Group", drawingNumber: "", clauseRef: "", requiresStamping: false, version: 1 }));
    p.checklists.NOC = DOC_LIBRARY.NOC.map((d) => ({ ...d, id: uid(), status: "approved", date: "10 May 2018", amendments: [], revision: "-", documentDate: "10 May 2018", preparedBy: "JT Building Pty Ltd", drawingNumber: "", clauseRef: "", requiresStamping: false, version: 1 }));
    p.checklists.OC = DOC_LIBRARY.OC.map((d) => ({ ...d, id: uid(), status: "approved", date: "10 Sep 2019", amendments: [], revision: "-", documentDate: "05 Sep 2019", preparedBy: "JT Building Pty Ltd", drawingNumber: "", clauseRef: "", requiresStamping: false, version: 1 }));
    p.inspections = INSPECTION_LIBRARY.map((i) => ({ ...i, id: uid(), outcome: "passed", date: "2019-07-19", defects: [], reportSent: true, reportSentDate: "19 Jul 2019", inspectorName: FIRM.certifierName, inspectorLicense: FIRM.certifierRego }));
    p.certificateRecords.pathway = {
      generated: true,
      generatedDate: "17 May 2018",
      issuedBy: { name: FIRM.certifierName, registrationNo: FIRM.certifierRego, registrationBody: FIRM.certifierBody },
      approvalUploaded: true,
      approvalDate: "18 May 2018",
      version: 1,
      modifications: [],
    };
    p.certificateRecords.oc.records = [
      {
        id: uid(),
        type: "whole",
        description: "",
        generatedDate: "10 Sep 2019",
        issuedBy: { name: FIRM.certifierName, registrationNo: FIRM.certifierRego, registrationBody: FIRM.certifierBody },
        approvalUploaded: true,
        approvalDate: "11 Sep 2019",
      },
    ];
    p.status = "complete";
    return p;
  })(),
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function StagePill({ label, done, progress }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${done ? "bg-emerald-700 text-white" : progress ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-slate-200 text-slate-500"}`}>
      {label}{progress ? ` ${progress}` : ""}
    </span>
  );
}

function checklistProgress(items) {
  if (items.length === 0) return null;
  const done = items.filter((i) => i.status === "approved").length;
  return `${done}/${items.length}`;
}

function inspectionProgress(project) {
  const items = project.inspections;
  if (items.length === 0) return null;
  const done = items.filter((i) => i.outcome === "passed" || i.outcome === "passed_subject_to").length;
  return `${done}/${items.length}`;
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const dt = new Date(`${isoDate}T00:00:00`);
  if (isNaN(dt)) return null;
  return Math.ceil((dt - new Date()) / (1000 * 60 * 60 * 24));
}

function buildTasks(projects) {
  const tasks = [];
  for (const p of projects) {
    const allDocs = [...p.checklists[p.pathway], ...p.checklists.NOC, ...p.checklists.OC];
    const openAmendments = allDocs.reduce((sum, i) => sum + unresolvedCount(i), 0);
    if (openAmendments > 0) {
      tasks.push({ priority: "High", text: `${openAmendments} open amendment point${openAmendments === 1 ? "" : "s"} awaiting client`, project: p });
    }
    const awaitingReview = allDocs.filter((i) => i.status === "submitted" && unresolvedCount(i) === 0).length;
    if (awaitingReview > 0) {
      tasks.push({ priority: "Medium", text: `${awaitingReview} document${awaitingReview === 1 ? "" : "s"} submitted — awaiting your review`, project: p });
    }
    const unconfirmedBookings = p.inspections.filter((i) => i.bookedByClient && !i.confirmed);
    unconfirmedBookings.forEach((i) => {
      tasks.push({ priority: "High", text: `Inspection booked by client — ${i.title} on ${i.date} — needs confirmation`, project: p });
    });
    if (stageComplete(p.checklists[p.pathway]) && !p.certificateRecords.pathway.generated) {
      tasks.push({ priority: "Medium", text: `Ready to generate ${p.pathway} certificate`, project: p });
    }
    if (pathwayIssued(p) && stageComplete(p.checklists.OC) && p.status !== "complete" && ocRecords(p).length === 0) {
      tasks.push({ priority: "Medium", text: "Ready to issue Occupation Certificate", project: p });
    }
    if (p.status !== "complete" && hasWholeOC(p)) {
      tasks.push({ priority: "Low", text: "Whole OC issued — ready to mark job complete", project: p });
    }
    const pendingInspections = p.inspections.filter((i) => i.outcome === "pending").length;
    if (pathwayIssued(p) && pendingInspections > 0) {
      tasks.push({ priority: "Medium", text: `${pendingInspections} inspection${pendingInspections === 1 ? "" : "s"} awaiting outcome`, project: p });
    }
    if (p.pathway === "CDC") {
      const lapse = effectiveLapseDate(p);
      const d = daysUntil(lapse);
      if (d !== null && d <= 90) {
        tasks.push({ priority: "High", text: d < 0 ? `CDC lapsed ${lapse}` : `CDC lapses in ${d} day${d === 1 ? "" : "s"} (${lapse})`, project: p });
      }
    }
  }
  const order = { High: 0, Medium: 1, Low: 2 };
  return tasks.sort((a, b) => order[a.priority] - order[b.priority]);
}

// Firm-level tasks not tied to any one job — currently just certifier
// compliance dates. These have project: null; the dashboard routes a click
// on one of these to Settings instead of a job.
function buildCertifierTasks(certifiers) {
  const tasks = [];
  for (const c of certifiers) {
    const piDays = daysUntil(c.piInsuranceExpiry);
    if (piDays !== null && piDays <= 30) {
      tasks.push({ priority: "High", text: piDays < 0 ? `${c.name}'s PI insurance expired` : `${c.name}'s PI insurance expires in ${piDays} day${piDays === 1 ? "" : "s"}`, project: null });
    }
    const regDays = daysUntil(c.registrationExpiry);
    if (regDays !== null && regDays <= 30) {
      tasks.push({ priority: "High", text: regDays < 0 ? `${c.name}'s registration/CPD renewal is overdue` : `${c.name}'s registration/CPD renewal due in ${regDays} day${regDays === 1 ? "" : "s"}`, project: null });
    }
  }
  const order = { High: 0, Medium: 1, Low: 2 };
  return tasks.sort((a, b) => order[a.priority] - order[b.priority]);
}

function TopBar({ clientName, onBack, showBack }) {
  return (
    <div className="bg-teal-800 text-white px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={onBack} className="p-1 rounded hover:bg-teal-700/60 transition-colors" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
        )}
        <span className="font-bold tracking-wide text-lg">CERTFLOW</span>
      </div>
      <span className="text-teal-100 text-sm">{clientName}</span>
    </div>
  );
}

function NavBar({ onHome, onNewJob, onListAll, onNewQuote, onListQuotes, onReports, onAudit, onSettings }) {
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [quotesOpen, setQuotesOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const projectsBtnRef = useRef(null);
  const quotesBtnRef = useRef(null);

  // Dropdowns are `position: fixed`, computed from the trigger button's
  // actual screen position — this is what lets them escape the nav bar's
  // horizontal-scroll clipping (an overflow-x-auto box clips both axes for
  // any absolutely-positioned child, including ones meant to float below it).
  const openDropdown = (which) => {
    const ref = which === "projects" ? projectsBtnRef : quotesBtnRef;
    const rect = ref.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom, left: rect.left });
    if (which === "projects") { setProjectsOpen((v) => !v); setQuotesOpen(false); }
    else { setQuotesOpen((v) => !v); setProjectsOpen(false); }
  };

  return (
    <div className="flex items-center relative bg-slate-900 border-b border-amber-900/40 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      <button onClick={onHome} className="font-serif font-bold tracking-wide text-lg py-4 pl-6 pr-4 text-amber-300 shrink-0 whitespace-nowrap">
        CERTFLOW
      </button>
      <div className="shrink-0">
        <button ref={projectsBtnRef} onClick={() => openDropdown("projects")} className="py-4 px-3 text-sm font-semibold flex items-center gap-1 text-slate-200 hover:text-amber-300 transition-colors whitespace-nowrap">
          Projects <ChevronDown size={14} />
        </button>
        {projectsOpen && (
          <div style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left }} className="z-50 w-64 bg-white rounded-b-lg shadow-xl border border-slate-100 py-2 text-slate-700">
            <button onClick={() => { onNewJob(); setProjectsOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">Create New Job</button>
            <button onClick={() => { onListAll(); setProjectsOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">List All Jobs</button>
          </div>
        )}
      </div>
      <div className="shrink-0">
        <button ref={quotesBtnRef} onClick={() => openDropdown("quotes")} className="py-4 px-3 text-sm font-semibold flex items-center gap-1 text-slate-200 hover:text-amber-300 transition-colors whitespace-nowrap">
          Quotes <ChevronDown size={14} />
        </button>
        {quotesOpen && (
          <div style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left }} className="z-50 w-64 bg-white rounded-b-lg shadow-xl border border-slate-100 py-2 text-slate-700">
            <button onClick={() => { onNewQuote(); setQuotesOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">Create New Quote</button>
            <button onClick={() => { onListQuotes(); setQuotesOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">List All Quotes</button>
          </div>
        )}
      </div>
      <button onClick={onReports} className="py-4 px-3 text-sm font-semibold text-slate-200 hover:text-amber-300 transition-colors shrink-0 whitespace-nowrap">Reports</button>
      <button onClick={onAudit} className="py-4 px-3 text-sm font-semibold text-slate-200 hover:text-amber-300 transition-colors shrink-0 whitespace-nowrap">Audit</button>
      <button onClick={onSettings} className="py-4 px-3 pr-6 text-sm font-semibold text-slate-200 hover:text-amber-300 transition-colors shrink-0 whitespace-nowrap">Settings</button>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const style = priority === "High" ? "bg-red-50 text-red-700" : priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500";
  return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${style}`}>{priority}</span>;
}

function BenchmarkMark({ className, style }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="0.75">
      <line x1="12" y1="1" x2="12" y2="23" />
      <line x1="1" y1="12" x2="23" y2="12" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

function Dashboard({ projects, certifiers, onOpenJob, onNewJob, onListAll, onSettings }) {
  const [query, setQuery] = useState("");
  const tasks = [...buildCertifierTasks(certifiers), ...buildTasks(projects)].slice(0, 6);

  const trimmedQuery = query.trim();
  const results = trimmedQuery
    ? projects.filter((p) => {
        const haystack = `${p.address} ${p.description} ${p.details.projectNumber || ""} ${p.id}`.toLowerCase();
        return haystack.includes(trimmedQuery.toLowerCase());
      })
    : [];

  return (
    <div className="relative min-h-screen flex flex-col items-center px-6 py-16 overflow-hidden bg-slate-900">
      {/* Faint architectural grid — a quiet nod to the survey plans this software processes */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "linear-gradient(rgba(217,180,120,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(217,180,120,0.4) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative w-full max-w-lg mt-8">
        {/* Benchmark tick marks at the corners, like registration marks on a drawing sheet */}
        <BenchmarkMark className="absolute -top-10 -left-10 w-5 h-5 text-amber-700/60" />
        <BenchmarkMark className="absolute -top-10 -right-10 w-5 h-5 text-amber-700/60" />
        <BenchmarkMark className="absolute -bottom-10 -left-10 w-5 h-5 text-amber-700/60" />
        <BenchmarkMark className="absolute -bottom-10 -right-10 w-5 h-5 text-amber-700/60" />

        <div className="text-center mb-10">
          <div className="font-serif text-5xl sm:text-6xl font-medium tracking-tight leading-none text-amber-300">CertFlow</div>
          <div className="mt-3 text-[13px] tracking-[0.2em] uppercase text-slate-400">
            {FIRM.name} · Certification Records
          </div>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by job number or address"
            className="w-full pl-11 pr-4 py-3.5 rounded-lg text-sm outline-none bg-slate-800 border border-amber-800/40 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-amber-600/50"
            autoFocus
          />
        </div>

        {trimmedQuery && (
          <div className="mt-4 rounded-lg overflow-hidden border border-amber-900/30 bg-slate-800/60">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">No jobs match "{trimmedQuery}".</div>
            ) : (
              results.map((p) => (
                <button key={p.id} onClick={() => onOpenJob(p.id)} className="w-full text-left px-4 py-3 border-t border-slate-700 first:border-t-0 hover:bg-slate-700/50 transition-colors">
                  <div className="font-medium text-sm text-slate-100">{p.address}</div>
                  <div className="text-xs text-slate-400">{p.pathway} · {p.description}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="relative w-full max-w-lg mt-10">
          <div className="text-[11px] tracking-[0.15em] uppercase text-slate-500 mb-2 px-1">Needs your attention</div>
          <div className="rounded-lg overflow-hidden border border-amber-900/30 bg-slate-800/60">
            {tasks.map((t, i) => {
              const dot = t.priority === "High" ? "bg-red-400" : t.priority === "Medium" ? "bg-amber-400" : "bg-slate-500";
              return (
                <button
                  key={i}
                  onClick={() => (t.project ? onOpenJob(t.project.id) : onSettings())}
                  className="w-full text-left px-4 py-3 border-t border-slate-700 first:border-t-0 hover:bg-slate-700/50 transition-colors flex items-start gap-3"
                >
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                  <div>
                    <div className="text-sm text-slate-100">{t.text}</div>
                    <div className="text-xs text-slate-500">{t.project ? t.project.address : "Certifier compliance — Settings"}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {buildTasks(projects).length + buildCertifierTasks(certifiers).length > tasks.length && (
            <button onClick={onListAll} className="w-full text-center mt-2 text-xs text-slate-500 hover:text-amber-300">
              View all jobs for the full list →
            </button>
          )}
        </div>
      )}

      <div className="relative text-center mt-12 text-[10px] tracking-[0.15em] uppercase text-slate-500">
        {FIRM.name} PTY LTD · ABN {FIRM.abn}
      </div>
    </div>
  );
}

function PickerModal({ title, library, existingTitles, onAdd, onClose }) {
  const [checked, setChecked] = useState(() => new Set());
  const [customText, setCustomText] = useState("");
  const [customItems, setCustomItems] = useState([]);

  const toggle = (t) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };
  const addCustom = () => {
    const text = customText.trim();
    if (!text) return;
    setCustomItems((prev) => [...prev, { title: text, desc: "Custom document request." }]);
    setCustomText("");
  };
  const confirm = () => {
    const fromLibrary = library.filter((l) => checked.has(l.title));
    const all = [...fromLibrary, ...customItems];
    if (all.length === 0) return;
    onAdd(all);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-teal-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-2">
          <div className="text-[11px] font-semibold tracking-wide text-slate-400 mb-1">COMMON ITEMS</div>
          {library.map((item) => {
            const already = existingTitles.includes(item.title);
            return (
              <label key={item.title} className={`flex items-start gap-3 p-2.5 rounded-md border ${already ? "border-slate-100 bg-slate-50 opacity-50" : "border-slate-100 hover:bg-teal-50/50 cursor-pointer"}`}>
                <input type="checkbox" disabled={already} checked={checked.has(item.title)} onChange={() => toggle(item.title)} className="mt-1 accent-teal-700" />
                <div>
                  <div className="text-sm font-semibold text-teal-900">{item.title}</div>
                  <div className="text-xs text-slate-500">{already ? "Already on this checklist" : item.desc}</div>
                </div>
              </label>
            );
          })}
          <div className="text-[11px] font-semibold tracking-wide text-slate-400 mt-4 mb-1">ADD YOUR OWN</div>
          <div className="flex gap-2">
            <input value={customText} onChange={(e) => setCustomText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="e.g. Acoustic report" className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
            <button onClick={addCustom} className="px-3 py-2 rounded-md bg-teal-800 text-white text-sm font-medium hover:bg-teal-900">Add</button>
          </div>
          {customItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {customItems.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-50 text-teal-800 text-xs font-medium">
                  {c.title}
                  <button onClick={() => setCustomItems((prev) => prev.filter((_, idx) => idx !== i))}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={confirm} className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">Add to checklist</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form building blocks (used by the New Job / Edit Details form)
// ---------------------------------------------------------------------------

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 mb-5">
      <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">{title}</div>
      <div className="p-5 space-y-5">{children}</div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex flex-col md:flex-row gap-2 md:gap-6">
      <div className="md:w-56 shrink-0">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
      </div>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", suffix, full }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      {label && <div className="text-xs text-slate-500 mb-1">{label}</div>}
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder, full = true }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      {label && <div className="text-xs text-slate-500 mb-1">{label}</div>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, full }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      {label && <div className="text-xs text-slate-500 mb-1">{label}</div>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600">
        <option value="">{placeholder || "Select..."}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// Multi-select as toggle chips — lets several classifications apply to one job
// at once (e.g. a dwelling is often 1a + 10a + 10b together).
// Searchable client picker — type to filter a long client list instead of
// scrolling a plain dropdown. Same native-datalist approach as Council LGA.
function ClientPicker({ clients, clientId, onChange, listId }) {
  const current = clients.find((c) => c.id === clientId);
  const [search, setSearch] = useState(clientLabel(current));

  const handleChange = (v) => {
    setSearch(v);
    if (!v.trim()) {
      onChange("");
      return;
    }
    const match = clients.find((c) => clientLabel(c) === v);
    if (match) onChange(match.id);
  };

  return (
    <div className="sm:col-span-2">
      <input
        list={listId}
        value={search}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search clients by name..."
        className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
      />
      <datalist id={listId}>
        {clients.map((c) => (
          <option key={c.id} value={clientLabel(c)} />
        ))}
      </datalist>
      {search.trim() && !clientId && <div className="text-xs text-amber-600 mt-1">No matching client — showing as "None assigned". Pick from the list or add them in Settings.</div>}
    </div>
  );
}

function MultiSelectField({ label, values, onChange, options, full = true }) {
  const toggle = (opt) => {
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  };
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      {label && <div className="text-xs text-slate-500 mb-1.5">{label}</div>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = values.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active ? "bg-teal-800 text-white border-teal-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {values.length === 0 && <div className="text-xs text-slate-400 mt-1">No classifications selected yet — click one or more above.</div>}
    </div>
  );
}

// Same idea as MultiSelectField, but also lets the person type a value that
// isn't in the preset list (e.g. an unusual development type). Custom entries
// show as chips too, with their own remove button.
function TagMultiSelectField({ label, values, onChange, options, emptyHint, full = true }) {
  const [customText, setCustomText] = useState("");
  const toggle = (opt) => {
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  };
  const addCustom = () => {
    const text = customText.trim();
    if (!text || values.includes(text)) return;
    onChange([...values, text]);
    setCustomText("");
  };
  const customValues = values.filter((v) => !options.includes(v));

  return (
    <div className={full ? "sm:col-span-2" : ""}>
      {label && <div className="text-xs text-slate-500 mb-1.5">{label}</div>}
      <div className="flex flex-wrap gap-2 mb-2">
        {options.map((opt) => {
          const active = values.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active ? "bg-teal-800 text-white border-teal-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {opt}
            </button>
          );
        })}
        {customValues.map((opt) => (
          <span key={opt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200">
            {opt}
            <button type="button" onClick={() => onChange(values.filter((v) => v !== opt))} className="hover:text-teal-900">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          placeholder="Type your own and press Enter to add"
          className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
        <button type="button" onClick={addCustom} className="px-3 py-2 rounded-md bg-teal-800 text-white text-sm font-medium hover:bg-teal-900">
          Add
        </button>
      </div>
      {values.length === 0 && emptyHint && <div className="text-xs text-slate-400 mt-1.5">{emptyHint}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Job / Edit Details — full intake form
// ---------------------------------------------------------------------------

function JobForm({ initialProject, certifiers, clients, onSave, onCancel }) {
  const isEdit = !!initialProject;
  const [address, setAddress] = useState(initialProject?.address || "");
  const [description, setDescription] = useState(initialProject?.description || "");
  const [types, setTypes] = useState(initialProject?.types || []);
  const [pathway, setPathway] = useState(initialProject?.pathway || "CDC");
  const [certifierId, setCertifierId] = useState(initialProject?.certifierId || certifiers[0]?.id || "");
  const [clientId, setClientId] = useState(initialProject?.clientId || "");
  const [d, setD] = useState(initialProject?.details ? JSON.parse(JSON.stringify(initialProject.details)) : emptyDetails());

  const set = (path, value) => {
    setD((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const selectCouncil = (name) => {
    set("council.lga", name);
    const match = COUNCIL_DIRECTORY.find((c) => c.name === name);
    if (match) {
      setD((prev) => ({
        ...prev,
        council: {
          ...prev.council,
          lga: match.name,
          address: { ...match.address },
          contact: { ...prev.council.contact, phone: match.phone, fax: match.fax, email: match.email },
        },
      }));
    }
  };

  const toggleCodePart = (part) => {
    setD((prev) => {
      const parts = prev.certificateDetails.codeParts.includes(part)
        ? prev.certificateDetails.codeParts.filter((p) => p !== part)
        : [...prev.certificateDetails.codeParts, part];
      return {
        ...prev,
        certificateDetails: {
          ...prev.certificateDetails,
          codeParts: parts,
          relevantInstrument: epiForCodeParts(parts),
          relevantPartOfCode: parts.join(", "),
        },
      };
    });
  };

  const canSubmit = address.trim().length > 0;

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="px-6 pt-6 pb-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
        <div>
          <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-800 mb-2">
            <ArrowLeft size={14} /> {isEdit ? "Back to job" : "All jobs"}
          </button>
          <h1 className="text-xl font-bold text-teal-900">{isEdit ? "Edit job details" : "New job"}</h1>
        </div>
        <button
          disabled={!canSubmit}
          onClick={() => canSubmit && onSave({ address, description: description || "No description provided", types, pathway, certifierId, clientId, details: d })}
          className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isEdit ? "Save changes" : "Create job"}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-start gap-2 bg-teal-50 border border-teal-100 rounded-md px-4 py-3 mb-5 text-sm text-teal-800">
          <Info size={16} className="mt-0.5 shrink-0" />
          This information is captured once and stays attached to the job — you'll be able to see it again from the Details tab during Inspections and when issuing the OC.
        </div>

        <Section title="Job basics">
          <Row label="Property address">
            <Field
              full
              value={address}
              onChange={(v) => {
                setAddress(v);
                if (!d.council.lga) {
                  const match = matchCouncilByAddress(v);
                  if (match) selectCouncil(match.name);
                }
              }}
              placeholder="e.g. 12 Example Street, Suburb NSW 2000"
            />
            {d.council.lga && <div className="sm:col-span-2 text-[11px] text-teal-600 mt-1">Council: {d.council.lga} — auto-matched from the suburb if recognized, otherwise set manually below.</div>}
          </Row>
          {address.trim() && (
            <Row label="">
              <div className="sm:col-span-2 -mt-3">
                <button
                  type="button"
                  onClick={() => window.open("https://www.planningportal.nsw.gov.au/spatialviewer/#/find-a-property/address", "_blank")}
                  className="text-xs text-teal-700 font-medium hover:underline inline-flex items-center gap-1"
                >
                  Look up Lot/DP, Section &amp; Zoning on NSW Planning Portal ↗
                </button>
                <div className="text-[11px] text-slate-400 mt-0.5">Opens the Spatial Viewer in a new tab — search this address there, then copy the Lot/DP, Section and Zone into the fields below.</div>
              </div>
            </Row>
          )}
          <Row label="Lot / Section / DP">
            <Field full value={d.certificateDetails.lotSectionDp} onChange={(v) => set("certificateDetails.lotSectionDp", v)} placeholder="e.g. 12/-/DP12345" />
          </Row>
          <Row label="Scope of works">
            <Field full value={description} onChange={setDescription} placeholder="e.g. Construction of a secondary dwelling" />
          </Row>
          <Row label="Job type" hint="Select all that apply, or add your own">
            <TagMultiSelectField values={types} onChange={setTypes} options={JOB_TYPES} emptyHint="No job types selected yet." />
          </Row>
          <Row label="Pathway" hint="Sets the first certification stage for this job">
            <div className="sm:col-span-2 flex gap-2">
              {["CDC", "CC"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPathway(p)}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold border ${pathway === p ? "bg-teal-800 text-white border-teal-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {p === "CDC" ? "Complying Development (CDC)" : "Construction Certificate (CC)"}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Certifier" hint="Default issuer for this job's CDC/CC and OC — can still be changed per certificate, and per inspection">
            <select
              value={certifierId}
              onChange={(e) => setCertifierId(e.target.value)}
              className="sm:col-span-2 w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {certifiers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Row>
          <Row label="Client" hint="Architect, builder, or owner who should see this job (and all their other jobs) in the client portal">
            <ClientPicker clients={clients} clientId={clientId} onChange={setClientId} listId="job-client-list" />
          </Row>
        </Section>

        <Section title="Project Configuration">
          <Row label="Project identifier" hint="Leave blank to use automatic number">
            <Field full label="Project number" value={d.projectNumber} onChange={(v) => set("projectNumber", v)} placeholder="Auto number" />
          </Row>
          <Row label="Zoning">
            <Field value={d.zoning} onChange={(v) => set("zoning", v)} placeholder="e.g. R2 Low Density Residential" />
          </Row>
          <Row label="BCA/NCC Version">
            <SelectField value={d.bcaVersion} onChange={(v) => set("bcaVersion", v)} options={BCA_VERSIONS} placeholder="Select BCA/NCC Version..." />
          </Row>
        </Section>

        <Section title="Company / Primary contact">
          <Row label="Name or company name">
            <Field full value={d.contact.nameOrCompany} onChange={(v) => set("contact.nameOrCompany", v)} />
          </Row>
          <Row label="Contact name">
            <Field label="Title" value={d.contact.title} onChange={(v) => set("contact.title", v)} />
            <Field label="Given name(s)" value={d.contact.givenNames} onChange={(v) => set("contact.givenNames", v)} />
            <Field label="Surname" value={d.contact.surname} onChange={(v) => set("contact.surname", v)} />
          </Row>
          <Row label="Contact details">
            <Field label="Phone" value={d.contact.phone} onChange={(v) => set("contact.phone", v)} />
            <Field label="Fax" value={d.contact.fax} onChange={(v) => set("contact.fax", v)} />
            <Field label="Mobile" value={d.contact.mobile} onChange={(v) => set("contact.mobile", v)} />
            <Field label="Email" type="email" value={d.contact.email} onChange={(v) => set("contact.email", v)} />
          </Row>
          <Row label="Applicant address">
            <Field label="Street number" value={d.applicantAddress.streetNumber} onChange={(v) => set("applicantAddress.streetNumber", v)} />
            <Field label="Street" value={d.applicantAddress.street} onChange={(v) => set("applicantAddress.street", v)} />
            <Field label="Suburb" value={d.applicantAddress.suburb} onChange={(v) => set("applicantAddress.suburb", v)} />
            <SelectField label="State" value={d.applicantAddress.state} onChange={(v) => set("applicantAddress.state", v)} options={NSW_STATE} />
            <Field label="Postcode" value={d.applicantAddress.postcode} onChange={(v) => set("applicantAddress.postcode", v)} />
          </Row>
        </Section>

        <Section title="Owner details">
          <Row label="Owner same as applicant">
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={d.ownerSameAsApplicant} onChange={(e) => set("ownerSameAsApplicant", e.target.checked)} className="accent-teal-700" />
                Use the applicant's details as the owner
              </label>
            </div>
          </Row>
          {!d.ownerSameAsApplicant && (
            <>
              <Row label="Owner name">
                <Field full value={d.owner.name} onChange={(v) => set("owner.name", v)} placeholder="e.g. Jane Smith & John Smith" />
              </Row>
              <Row label="Owner address">
                <Field label="Street number" value={d.owner.address.streetNumber} onChange={(v) => set("owner.address.streetNumber", v)} />
                <Field label="Street" value={d.owner.address.street} onChange={(v) => set("owner.address.street", v)} />
                <Field label="Suburb" value={d.owner.address.suburb} onChange={(v) => set("owner.address.suburb", v)} />
                <SelectField label="State" value={d.owner.address.state} onChange={(v) => set("owner.address.state", v)} options={NSW_STATE} />
                <Field label="Postcode" value={d.owner.address.postcode} onChange={(v) => set("owner.address.postcode", v)} />
              </Row>
              <Row label="Owner phone">
                <Field value={d.owner.phone} onChange={(v) => set("owner.phone", v)} />
              </Row>
            </>
          )}
        </Section>

        <Section title={`${pathway} Certificate Details`}>
          <Row label="NSW Planning Portal Ref Number">
            <Field value={d.certificateDetails.planningPortalRef} onChange={(v) => set("certificateDetails.planningPortalRef", v)} placeholder="e.g. CDC-331766" />
          </Row>
          <Row label="Relevant Environmental Planning Instrument">
            {pathway === "CDC" ? (
              <div className="sm:col-span-2 text-sm text-slate-600">{d.certificateDetails.relevantInstrument || "Select code parts below to set this automatically"}</div>
            ) : (
              <TextAreaField value={d.certificateDetails.relevantInstrument} onChange={(v) => set("certificateDetails.relevantInstrument", v)} placeholder="e.g. State Environmental Planning Policy (Housing) 2021" />
            )}
          </Row>
          {pathway === "CDC" ? (
            <Row label="Relevant Part of Code" hint="Tick every part of SEPP 2008 that this CDC relies on">
              <div className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {SEPP_CODE_PARTS.map((part) => {
                    const active = d.certificateDetails.codeParts.includes(part);
                    return (
                      <button
                        type="button"
                        key={part}
                        onClick={() => toggleCodePart(part)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          active ? "bg-teal-800 text-white border-teal-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {part}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {d.certificateDetails.codeParts.length === 0
                    ? "Nothing selected yet."
                    : `Certificate will show: ${d.certificateDetails.relevantPartOfCode}`}
                </div>
              </div>
            </Row>
          ) : (
            <Row label="Relevant Part of Code">
              <Field full value={d.certificateDetails.relevantPartOfCode} onChange={(v) => set("certificateDetails.relevantPartOfCode", v)} placeholder="e.g. Schedule 1 — Complying Development Secondary Dwelling" />
            </Row>
          )}
          <div className="sm:col-span-2 text-xs text-slate-400 italic">Date of Determination and Date of Lapse are recorded when the certificate is generated, not at intake.</div>
        </Section>

        <Section title="Council">
          <Row label="Local Government Area" hint="Type to search a known council — selecting one fills in the address and contact details automatically">
            <div className="sm:col-span-2">
              <input
                list="council-directory-list"
                value={d.council.lga}
                onChange={(e) => selectCouncil(e.target.value)}
                placeholder="e.g. Fairfield City Council"
                className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <datalist id="council-directory-list">
                {COUNCIL_DIRECTORY.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
              </datalist>
            </div>
          </Row>
          <Row label="Address">
            <Field label="Street number" value={d.council.address.streetNumber} onChange={(v) => set("council.address.streetNumber", v)} />
            <Field label="Street" value={d.council.address.street} onChange={(v) => set("council.address.street", v)} />
            <Field label="Suburb" value={d.council.address.suburb} onChange={(v) => set("council.address.suburb", v)} />
            <SelectField label="State" value={d.council.address.state} onChange={(v) => set("council.address.state", v)} options={NSW_STATE} />
            <Field label="Postcode" value={d.council.address.postcode} onChange={(v) => set("council.address.postcode", v)} />
          </Row>
          <Row label="Contact details">
            <Field label="Phone" value={d.council.contact.phone} onChange={(v) => set("council.contact.phone", v)} />
            <Field label="Fax" value={d.council.contact.fax} onChange={(v) => set("council.contact.fax", v)} />
            <Field full label="Email" type="email" value={d.council.contact.email} onChange={(v) => set("council.contact.email", v)} />
          </Row>
        </Section>

        <Section title="Proposal Details">
          <Row label="Building classification" hint="Select all that apply">
            <MultiSelectField values={d.proposal.classifications} onChange={(v) => set("proposal.classifications", v)} options={BUILDING_CLASSIFICATIONS} />
          </Row>
          <Row label="Construction">
            <SelectField label="Type" value={d.proposal.constructionType} onChange={(v) => set("proposal.constructionType", v)} options={CONSTRUCTION_TYPES} />
          </Row>
          <Row label="Dwellings">
            <Field label="Existing" type="number" value={d.proposal.dwellingsExisting} onChange={(v) => set("proposal.dwellingsExisting", v)} />
            <Field label="Demolished" type="number" value={d.proposal.dwellingsDemolished} onChange={(v) => set("proposal.dwellingsDemolished", v)} />
            <Field label="New" type="number" value={d.proposal.dwellingsNew} onChange={(v) => set("proposal.dwellingsNew", v)} />
          </Row>
          <Row label="Total estimated cost / value of project">
            <Field full type="number" value={d.proposal.estimatedCost} onChange={(v) => set("proposal.estimatedCost", v)} suffix="AUD" />
          </Row>
          <Row label="No. of storeys">
            <Field label="Above ground" type="number" value={d.proposal.storeysAbove} onChange={(v) => set("proposal.storeysAbove", v)} />
            <Field label="Below ground" type="number" value={d.proposal.storeysBelow} onChange={(v) => set("proposal.storeysBelow", v)} />
            <Field label="Total storeys" type="number" value={d.proposal.storeysTotal} onChange={(v) => set("proposal.storeysTotal", v)} />
          </Row>
          <Row label="Effective height">
            <Field type="number" value={d.proposal.effectiveHeight} onChange={(v) => set("proposal.effectiveHeight", v)} suffix="m" />
          </Row>
          <Row label="Floor area">
            <Field label="Existing floor area" type="number" value={d.proposal.floorAreaExisting} onChange={(v) => set("proposal.floorAreaExisting", v)} suffix="m²" />
            <Field label="New floor area" type="number" value={d.proposal.floorAreaNew} onChange={(v) => set("proposal.floorAreaNew", v)} suffix="m²" />
          </Row>
        </Section>

        <Section title="Proposal site">
          <Row label="Total area of land">
            <Field full type="number" value={d.siteArea} onChange={(v) => set("siteArea", v)} suffix="m²" />
          </Row>
        </Section>

        <Section title="Building Description">
          <Row label="Building description">
            <TextAreaField value={d.buildingDescription} onChange={(v) => set("buildingDescription", v)} />
          </Row>
        </Section>

        <div className="flex justify-end gap-2 pb-10">
          <button onClick={onCancel} className="px-4 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button
            disabled={!canSubmit}
            onClick={() => canSubmit && onSave({ address, description: description || "No description provided", types, pathway, certifierId, clientId, details: d })}
            className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEdit ? "Save changes" : "Create job"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project list view
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

function QuoteDocumentModal({ quote, onSaveOverride, onClose }) {
  const contentRef = useRef(null);
  const subtotal = quote.feeLines.reduce((sum, l) => sum + (Number(l.amount) || 0) * (Number(l.quantity) || 1), 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;
  const applicantName = quote.applicant.name || "—";
  const ownerName = quote.ownerIsApplicant ? applicantName : quote.owner.name || "—";
  const pathwayFull = quote.pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate";
  const validForDays = (quote.validFor || "").replace(" Days", "").replace(" Day", "");

  const defaultTerms = [
    `${FIRM.name} is pleased to submit a fee proposal to provide building approval and certification services for the proposed development.`,
    `We pride ourselves on our ability to deliver easier and faster building approvals, and to add value and exceed client expectations at every stage of the approval process.`,
    `Thank you for the opportunity. We look forward to establishing a working relationship with your business and your staff.`,
  ].join("\n\n");
  const [editing, setEditing] = useState(false);
  const activeTerms = quote.termsOverride || defaultTerms;
  const [draft, setDraft] = useState(activeTerms);

  const startEdit = () => {
    setDraft(activeTerms);
    setEditing(true);
  };
  const save = () => {
    onSaveOverride(draft);
    setEditing(false);
  };
  const resetToAuto = () => {
    onSaveOverride("");
    setDraft(defaultTerms);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-3 flex justify-between items-center print:hidden">
          <span className="text-sm font-semibold text-slate-600">Quote preview</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">Print / Save as PDF</button>
            <button
              onClick={() => downloadAsWordDoc(`Quote-${quote.id}.doc`, contentRef.current.innerHTML)}
              className="px-3 py-1.5 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50"
            >
              Export as Word
            </button>
            <a
              href={buildQuoteMailto(quote, total)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50"
            >
              <Mail size={14} /> Email to client
            </a>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><X size={18} /></button>
          </div>
        </div>

        {!quote.applicant.email && (
          <div className="px-6 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100 print:hidden">
            No applicant email on file — add one under Contact Details so "Email to client" can pre-fill the recipient.
          </div>
        )}

        <div className="p-8 text-slate-900" ref={contentRef}>
          <div className="flex justify-between items-start pb-3 mb-1">
            <div>
              <div className="text-xl font-black tracking-tight">{FIRM.name}</div>
              <div className="text-[11px] text-slate-500 tracking-wide">PTY LTD</div>
            </div>
            <div className="text-right text-xs text-slate-700 leading-relaxed">
              <div className="font-bold">{FIRM.name} Pty Ltd</div>
              <div>{FIRM.office}</div>
              <div className="mt-1">Phone: {FIRM.phone}</div>
              <div className="text-blue-700 underline">{FIRM.email}</div>
              <div className="text-blue-700 underline">{FIRM.website}</div>
            </div>
          </div>
          <div className="border-b border-slate-800 mb-4" />

          <div className="flex justify-between text-sm mb-6">
            <div>Quote Number: {quote.id.toUpperCase()}</div>
            <div>Date: {today()}</div>
          </div>

          <div className="text-center mb-6">
            <div className="font-bold">FEE PROPOSAL</div>
            <div className="font-bold">FOR</div>
            <div className="font-bold">{pathwayFull} and Principal Certifier Services</div>
          </div>

          <div className="text-sm mb-3"><u className="font-semibold">Property Address:</u> {quote.proposalAddress || "—"}</div>
          <div className="text-sm mb-4"><u className="font-semibold">Job Description:</u> {quote.developmentDescription || "—"}</div>

          <div className="text-sm font-semibold underline mb-2">Scope of Works</div>
          <ul className="list-disc pl-6 text-sm mb-6 space-y-0.5">
            {quote.scopeOfWorks.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          <table className="w-full mb-1 border border-slate-300 text-sm">
            <thead>
              <tr style={{ backgroundColor: "#B8B49A" }}>
                <th className="text-left font-semibold px-3 py-2 border border-slate-300">Description</th>
                <th className="text-center font-semibold px-3 py-2 border border-slate-300 w-24">Quantity</th>
                <th className="text-right font-semibold px-3 py-2 border border-slate-300 w-28">Unit Price</th>
              </tr>
            </thead>
            <tbody>
              {quote.feeLines.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-1.5 border border-slate-300">{l.description || "—"}</td>
                  <td className="px-3 py-1.5 border border-slate-300 text-center">{l.quantity || "1"}</td>
                  <td className="px-3 py-1.5 border border-slate-300 text-right">{l.amount ? Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col items-end gap-0.5 text-sm mb-4">
            <div className="flex gap-4"><span className="text-slate-500">Subtotal:</span><span>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex gap-4"><span className="text-slate-500">GST:</span><span>${gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex gap-4 font-bold"><span>Total:</span><span>${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          </div>

          <div className="text-sm font-bold underline mb-4">***Our fee is valid for {validForDays || "30"} days from the date of fee proposal issuance.</div>

          <div className="print:hidden flex items-center gap-2 mb-1">
            {!editing && (
              <button onClick={startEdit} className="flex items-center gap-1 text-xs text-teal-700 font-medium hover:underline">
                <Pencil size={12} /> Edit closing text
              </button>
            )}
            {!editing && quote.termsOverride && (
              <button onClick={resetToAuto} className="text-xs text-slate-400 hover:underline">Reset to auto-generated</button>
            )}
          </div>

          {editing ? (
            <div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <div className="flex gap-2 mt-2 print:hidden">
                <button onClick={save} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900">Save</button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-slate-500 hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="text-sm space-y-3">
              {activeTerms.split("\n\n").map((para, i) => (
                <p key={i} className="whitespace-pre-line">{para}</p>
              ))}
            </div>
          )}

          <div className="text-sm mt-6">
            <div>Kind Regards</div>
            <div>{FIRM.name} Pty Ltd</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuoteForm({ initialQuote, clients, onSave, onCancel, onSetStatus, onGenerateJob, onMarkPaid }) {
  const isEdit = !!initialQuote;
  const [q, setQ] = useState(initialQuote ? JSON.parse(JSON.stringify(initialQuote)) : emptyQuote());

  const set = (path, value) => {
    setQ((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const canSubmit = q.proposalAddress.trim().length > 0;
  const statusMeta = QUOTE_STATUS_META[q.status];
  const [docOpen, setDocOpen] = useState(false);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="px-6 pt-6 pb-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
        <div>
          <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-800 mb-2">
            <ArrowLeft size={14} /> {isEdit ? "Back to quotes" : "All quotes"}
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-teal-900">{isEdit ? "Edit quote" : "New quote"}</h1>
            {isEdit && <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusMeta.style}`}>{statusMeta.label}</span>}
            {isEdit && q.status !== "draft" && (
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${q.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {q.paymentStatus === "paid" ? `Paid ${q.paymentReceivedDate}` : "Unpaid"}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <button onClick={() => setDocOpen(true)} className="px-3.5 py-2 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50">
              View quote
            </button>
          )}
          {isEdit && q.status === "draft" && (
            <button
              onClick={() => { onSetStatus(q.id, "sent"); setDocOpen(true); }}
              className="px-3.5 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900"
            >
              Issue quote to client
            </button>
          )}
          {isEdit && q.status === "sent" && (
            <>
              <button onClick={() => onSetStatus(q.id, "declined")} className="px-3.5 py-2 rounded-md border border-red-200 text-sm text-red-700 font-medium hover:bg-red-50">Mark declined</button>
              <button onClick={() => onSetStatus(q.id, "accepted")} className="px-3.5 py-2 rounded-md border border-emerald-200 text-sm text-emerald-700 font-medium hover:bg-emerald-50">Mark accepted</button>
            </>
          )}
          {isEdit && q.status === "accepted" && !q.linkedJobId && (
            <button onClick={() => onGenerateJob(q.id)} className="px-3.5 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">Generate job from quote</button>
          )}
          {isEdit && q.status !== "draft" && q.paymentStatus !== "paid" && (
            <button onClick={() => onMarkPaid(q.id)} className="px-3.5 py-2 rounded-md border border-emerald-200 text-sm text-emerald-700 font-medium hover:bg-emerald-50">Mark as paid</button>
          )}
          {isEdit && q.linkedJobId && (
            <span className="flex items-center gap-1.5 px-3 py-2 text-sm text-emerald-700 font-medium"><Check size={14} /> Job created</span>
          )}
          <button
            disabled={!canSubmit}
            onClick={() => canSubmit && onSave(q)}
            className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        <Section title="Quote Details">
          <Row label="Quote No." hint="Automatic numbering">
            <Field value={q.id.toUpperCase()} onChange={() => {}} placeholder="Auto" />
          </Row>
          <Row label="State / Project Type">
            <SelectField label="State" value={q.state} onChange={(v) => set("state", v)} options={NSW_STATE} />
            <SelectField label="Project Type" value={q.projectType} onChange={(v) => set("projectType", v)} options={JOB_TYPES} placeholder="None" />
          </Row>
          <Row label="Pathway" hint="Used if this quote converts into a job">
            <div className="sm:col-span-2 flex gap-2">
              {["CDC", "CC"].map((p) => (
                <button key={p} onClick={() => set("pathway", p)} className={`flex-1 py-2 rounded-md text-sm font-semibold border ${q.pathway === p ? "bg-teal-800 text-white border-teal-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {p}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Project Dates">
            <Field label="Required start date" type="date" value={q.requiredStartDate} onChange={(v) => set("requiredStartDate", v)} />
            <Field label="Required end date" type="date" value={q.requiredEndDate} onChange={(v) => set("requiredEndDate", v)} />
          </Row>
          <Row label="Quote valid for">
            <SelectField value={q.validFor} onChange={(v) => set("validFor", v)} options={VALID_FOR_OPTIONS} />
          </Row>
        </Section>

        <Section title="Proposal">
          <Row label="Proposal address">
            <Field
              full
              value={q.proposalAddress}
              onChange={(v) => {
                set("proposalAddress", v);
                if (!q.councilLga) {
                  const match = matchCouncilByAddress(v);
                  if (match) set("councilLga", match.name);
                }
              }}
              placeholder="Start typing an address"
            />
            {q.councilLga && <div className="sm:col-span-2 text-[11px] text-teal-600 mt-1">Council: {q.councilLga} — auto-matched from the suburb if recognized, otherwise set manually below.</div>}
          </Row>
          <Row label="Lot/Section/Plan">
            <Field full value={q.lotSectionPlan} onChange={(v) => set("lotSectionPlan", v)} placeholder="e.g. 12/-/DP12345" />
          </Row>
          <Row label="Project title">
            <Field full value={q.projectTitle} onChange={(v) => set("projectTitle", v)} placeholder="e.g. Smith Residence — 99 Aviary Road, Sydney" />
          </Row>
          <Row label="Certifier">
            <Field full value={q.certifier} onChange={(v) => set("certifier", v)} />
          </Row>
          <Row label="Building classification" hint="Select all that apply">
            <MultiSelectField values={q.classifications} onChange={(v) => set("classifications", v)} options={BUILDING_CLASSIFICATIONS} />
          </Row>
          <Row label="Development description">
            <TextAreaField value={q.developmentDescription} onChange={(v) => set("developmentDescription", v)} placeholder="e.g. New dwelling, house" />
          </Row>
        </Section>

        <Section title="Contact Details">
          <Row label="Owner is applicant">
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={q.ownerIsApplicant} onChange={(e) => set("ownerIsApplicant", e.target.checked)} className="accent-teal-700" />
                Owner is the applicant
              </label>
            </div>
          </Row>
          <Row label="Applicant">
            <Field label="Name" value={q.applicant.name} onChange={(v) => set("applicant.name", v)} />
            <Field label="Phone" value={q.applicant.phone} onChange={(v) => set("applicant.phone", v)} />
            <Field label="Email" type="email" value={q.applicant.email} onChange={(v) => set("applicant.email", v)} />
            <Field label="Street number" value={q.applicant.address.streetNumber} onChange={(v) => set("applicant.address.streetNumber", v)} />
            <Field label="Street" value={q.applicant.address.street} onChange={(v) => set("applicant.address.street", v)} />
            <Field label="Suburb" value={q.applicant.address.suburb} onChange={(v) => set("applicant.address.suburb", v)} />
            <SelectField label="State" value={q.applicant.address.state} onChange={(v) => set("applicant.address.state", v)} options={NSW_STATE} />
            <Field label="Postcode" value={q.applicant.address.postcode} onChange={(v) => set("applicant.address.postcode", v)} />
          </Row>
          <Row label="Client" hint="Link this quote to a client so it can flow through to the job automatically">
            <ClientPicker clients={clients} clientId={q.clientId} onChange={(id) => set("clientId", id)} listId="quote-client-list" />
          </Row>
          {!q.ownerIsApplicant && (
            <Row label="Owner">
              <Field label="Name" value={q.owner.name} onChange={(v) => set("owner.name", v)} />
              <Field label="Phone" value={q.owner.phone} onChange={(v) => set("owner.phone", v)} />
              <Field label="Email" type="email" value={q.owner.email} onChange={(v) => set("owner.email", v)} />
            </Row>
          )}
        </Section>

        <Section title="Council">
          <Row label="Local Government Area">
            <Field full value={q.councilLga} onChange={(v) => set("councilLga", v)} placeholder="Search for and select the council area" />
          </Row>
        </Section>

        <Section title="Scope of Works">
          <div className="sm:col-span-2 space-y-2">
            {q.scopeOfWorks.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  value={item}
                  onChange={(e) => set(`scopeOfWorks.${idx}`, e.target.value)}
                  className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  onClick={() => setQ((prev) => ({ ...prev, scopeOfWorks: prev.scopeOfWorks.filter((_, i) => i !== idx) }))}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setQ((prev) => ({ ...prev, scopeOfWorks: [...prev.scopeOfWorks, ""] }))}
              className="flex items-center gap-1.5 text-sm text-teal-700 font-medium hover:underline"
            >
              <Plus size={14} /> Add scope item
            </button>
          </div>
        </Section>

        <Section title="Fee">
          <div className="sm:col-span-2 space-y-2">
            <div className="flex gap-2 items-center text-xs text-slate-400 px-1">
              <span className="flex-1">Description</span>
              <span className="w-16 text-center">Qty</span>
              <span className="w-32 text-right pr-8">Unit Price</span>
            </div>
            {q.feeLines.map((line, idx) => (
              <div key={line.id} className="flex gap-2 items-center">
                <input
                  value={line.description}
                  onChange={(e) => set(`feeLines.${idx}.description`, e.target.value)}
                  placeholder="e.g. CDC/PC/OC"
                  className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => set(`feeLines.${idx}.quantity`, e.target.value)}
                  placeholder="1"
                  className="w-16 px-2 py-2 rounded-md border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <input
                  type="number"
                  value={line.amount}
                  onChange={(e) => set(`feeLines.${idx}.amount`, e.target.value)}
                  placeholder="0.00"
                  className="w-32 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  onClick={() => setQ((prev) => ({ ...prev, feeLines: prev.feeLines.filter((_, i) => i !== idx) }))}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setQ((prev) => ({ ...prev, feeLines: [...prev.feeLines, { id: uid(), description: "", quantity: "1", amount: "" }] }))}
              className="flex items-center gap-1.5 text-sm text-teal-700 font-medium hover:underline"
            >
              <Plus size={14} /> Add fee line
            </button>
            {(() => {
              const subtotal = q.feeLines.reduce((sum, l) => sum + (Number(l.amount) || 0) * (Number(l.quantity) || 1), 0);
              const gst = subtotal * 0.1;
              return (
                <div className="flex flex-col items-end gap-0.5 pt-2 border-t border-slate-100 mt-2 text-sm">
                  <div className="text-slate-500">Subtotal: ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="text-slate-500">GST (10%): ${gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="font-bold text-teal-900">Total: ${(subtotal + gst).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
              );
            })()}
          </div>
        </Section>

        <div className="flex justify-end gap-2 pb-10">
          <button onClick={onCancel} className="px-4 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button disabled={!canSubmit} onClick={() => canSubmit && onSave(q)} className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-40 disabled:cursor-not-allowed">
            Save
          </button>
        </div>
      </div>

      {docOpen && <QuoteDocumentModal quote={q} onSaveOverride={(text) => set("termsOverride", text)} onClose={() => setDocOpen(false)} />}
    </div>
  );
}

function QuoteList({ quotes, onSelect, onNewQuote }) {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="px-6 py-5 flex items-center gap-3">
        <h2 className="text-xl font-bold text-teal-900">Quotes</h2>
        <button onClick={onNewQuote} className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
          <Plus size={16} /> New quote
        </button>
      </div>
      <div className="mx-6 mb-6 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white text-left">
              <th className="px-5 py-3 font-semibold">Quote No.</th>
              <th className="px-5 py-3 font-semibold">Proposal Address</th>
              <th className="px-5 py-3 font-semibold w-32">Status</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} onClick={() => onSelect(q.id)} className="border-t border-slate-100 hover:bg-teal-50/60 cursor-pointer">
                <td className="px-5 py-4 text-slate-500">{q.id.toUpperCase()}</td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-teal-900">{q.proposalAddress || "—"}</div>
                  <div className="text-slate-500 text-xs">{q.developmentDescription}</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${QUOTE_STATUS_META[q.status].style}`}>{QUOTE_STATUS_META[q.status].label}</span>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-400">No quotes yet. Click "New quote" to create one.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function AuditPage({ projects, certifiers }) {
  const events = buildAuditEvents(projects);
  const [expanded, setExpanded] = useState(null); // certifier name currently expanded, or null

  const parseDate = (s) => parseDisplayDate(s) || new Date(0);

  return (
    <div className="bg-slate-50 min-h-screen px-6 py-6">
      <h2 className="text-xl font-bold text-teal-900 mb-1">Certifier Audit</h2>
      <p className="text-slate-500 text-sm mb-6 max-w-2xl">
        What each registered certifier has actually issued or carried out, across every job — derived from real issuance and inspection records, not a separate log.
      </p>

      <div className="space-y-4 max-w-3xl">
        {certifiers.map((c) => {
          const own = events.filter((e) => e.certifierName === c.name).sort((a, b) => parseDate(b.date) - parseDate(a.date));
          const cdcCount = own.filter((e) => e.type === "cdc_cc").length;
          const modCount = own.filter((e) => e.type === "modification").length;
          const ocCount = own.filter((e) => e.type === "oc").length;
          const inspCount = own.filter((e) => e.type === "inspection").length;
          const inspPassed = own.filter((e) => e.type === "inspection" && e.action.includes("(Passed)")).length;
          const inspFailed = own.filter((e) => e.type === "inspection" && e.action.includes("(Failed)")).length;
          const isOpen = expanded === c.name;

          return (
            <div key={c.id} className="rounded-lg overflow-hidden border border-slate-200 bg-white">
              <button onClick={() => setExpanded(isOpen ? null : c.name)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="text-left">
                  <div className="font-semibold text-teal-900">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.registrationBody} · {c.registrationNo}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex gap-4 text-xs text-slate-500">
                    <span><span className="font-bold text-teal-800">{cdcCount}</span> CDC/CC issued</span>
                    <span><span className="font-bold text-teal-800">{modCount}</span> modifications</span>
                    <span><span className="font-bold text-teal-800">{ocCount}</span> OC issued</span>
                    <span><span className="font-bold text-teal-800">{inspCount}</span> inspections{inspCount > 0 && ` (${inspPassed} passed, ${inspFailed} failed)`}</span>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
              <div className="sm:hidden flex flex-wrap gap-2 px-5 pb-3 text-xs text-slate-500">
                <span><span className="font-bold text-teal-800">{cdcCount}</span> CDC/CC</span>
                <span><span className="font-bold text-teal-800">{modCount}</span> mods</span>
                <span><span className="font-bold text-teal-800">{ocCount}</span> OC</span>
                <span><span className="font-bold text-teal-800">{inspCount}</span> inspections</span>
              </div>
              {isOpen && (
                own.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-400 border-t border-slate-100">No recorded activity yet.</div>
                ) : (
                  <div className="border-t border-slate-100">
                    {own.map((e, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3 border-t border-slate-100 first:border-t-0 text-sm">
                        <div>
                          <span className="text-slate-700">{e.action}</span>
                          <span className="text-slate-400"> — {e.project.address}</span>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap ml-3">{e.date}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function ReportsPage({ projects }) {
  const [granularity, setGranularity] = useState("month"); // month | year | all
  const events = buildIssuanceEvents(projects);

  const bucketKey = (dt) => {
    if (granularity === "all") return "All time";
    if (granularity === "year") return String(dt.getFullYear());
    return `${MONTH_ABBR[dt.getMonth()]} ${dt.getFullYear()}`;
  };

  const buckets = {};
  for (const e of events) {
    const key = bucketKey(e.date);
    if (!buckets[key]) buckets[key] = { CDC: 0, CC: 0, NOC: 0, OC: 0, sortDate: e.date };
    buckets[key][e.type] += 1;
    if (e.date > buckets[key].sortDate) buckets[key].sortDate = e.date;
  }
  const rows = Object.entries(buckets).sort((a, b) => b[1].sortDate - a[1].sortDate);
  const totals = rows.reduce(
    (acc, [, v]) => ({ CDC: acc.CDC + v.CDC, CC: acc.CC + v.CC, NOC: acc.NOC + v.NOC, OC: acc.OC + v.OC }),
    { CDC: 0, CC: 0, NOC: 0, OC: 0 }
  );

  return (
    <div className="bg-slate-50 min-h-screen px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-teal-900">Issuance Report</h2>
        <div className="flex gap-2">
          {[
            { key: "month", label: "By Month" },
            { key: "year", label: "By Year" },
            { key: "all", label: "All Time" },
          ].map((g) => (
            <button
              key={g.key}
              onClick={() => setGranularity(g.key)}
              className={`px-3.5 py-2 rounded-md text-sm font-semibold border ${granularity === g.key ? "bg-teal-800 text-white border-teal-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3 max-w-xl">
        {["CDC", "CC", "NOC", "OC"].map((t) => (
          <div key={t} className="bg-white rounded-lg border border-slate-200 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-teal-900">{totals[t]}</div>
            <div className="text-xs text-slate-400">{t} issued</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-w-3xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white text-left">
              <th className="px-5 py-3 font-semibold">{granularity === "all" ? "Period" : granularity === "year" ? "Year" : "Month"}</th>
              <th className="px-5 py-3 font-semibold text-center w-20">CDC</th>
              <th className="px-5 py-3 font-semibold text-center w-20">CC</th>
              <th className="px-5 py-3 font-semibold text-center w-20">NOC</th>
              <th className="px-5 py-3 font-semibold text-center w-20">OC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, v]) => (
              <tr key={key} className="border-t border-slate-100">
                <td className="px-5 py-3 font-medium text-teal-900">{key}</td>
                <td className="px-5 py-3 text-center">{v.CDC || "—"}</td>
                <td className="px-5 py-3 text-center">{v.CC || "—"}</td>
                <td className="px-5 py-3 text-center">{v.NOC || "—"}</td>
                <td className="px-5 py-3 text-center">{v.OC || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">No certificates or NOCs issued yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings — certifier registry
// ---------------------------------------------------------------------------

function SettingsPage({ certifiers, onAdd, onRemove, onSetSignature, onSetExpiry, clients, onAddClient, onRemoveClient }) {
  const [name, setName] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [registrationBody, setRegistrationBody] = useState("Building Commission NSW");

  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState(CLIENT_TYPES[0]);
  const [clientCompany, setClientCompany] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  const add = () => {
    if (!name.trim() || !registrationNo.trim()) return;
    onAdd(name.trim(), registrationNo.trim(), registrationBody.trim());
    setName("");
    setRegistrationNo("");
  };

  const addClient = () => {
    if (!clientName.trim()) return;
    onAddClient({ name: clientName.trim(), type: clientType, company: clientCompany.trim(), email: clientEmail.trim(), phone: clientPhone.trim() });
    setClientName("");
    setClientCompany("");
    setClientEmail("");
    setClientPhone("");
  };

  return (
    <div className="bg-slate-50 min-h-screen px-6 py-6">
      <h2 className="text-xl font-bold text-teal-900 mb-1">Certifiers</h2>
      <p className="text-slate-500 text-sm mb-4 max-w-xl">
        Add every registered certifier at the firm. Any of them can then be selected as the issuing certifier on a CDC/CC, OC, or inspection — not just the default.
      </p>

      <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-w-2xl mb-6">
        <div className="bg-slate-800 text-white px-5 py-3 flex justify-between text-sm font-semibold">
          <span>Name</span>
          <span>Registration</span>
        </div>
        {certifiers.map((c) => {
          const piDays = daysUntil(c.piInsuranceExpiry);
          const regDays = daysUntil(c.registrationExpiry);
          const piWarn = piDays !== null && piDays <= 30;
          const regWarn = regDays !== null && regDays <= 30;
          return (
          <div key={c.id} className="border-t border-slate-100">
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                {c.signatureUrl ? (
                  <img src={c.signatureUrl} alt={`${c.name} signature`} className="h-8 max-w-[100px] object-contain border border-slate-100 rounded bg-white" />
                ) : (
                  <div className="h-8 w-[100px] border border-dashed border-slate-200 rounded flex items-center justify-center text-[9px] text-slate-300">No signature</div>
                )}
                <div>
                  <div className="font-medium text-teal-900 text-sm">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.registrationBody}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{c.registrationNo}</span>
                <label className="text-xs text-teal-700 font-medium hover:underline cursor-pointer">
                  {c.signatureUrl ? "Replace signature" : "Upload signature"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) onSetSignature(c.id, e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {certifiers.length > 1 && (
                  <button onClick={() => onRemove(c.id)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="px-5 pb-3 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">PI insurance expiry:</span>
                <input
                  type="date"
                  value={c.piInsuranceExpiry}
                  onChange={(e) => onSetExpiry(c.id, "piInsuranceExpiry", e.target.value)}
                  className={`px-2 py-1 rounded border text-xs ${piWarn ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}
                />
                {piWarn && <span className="text-amber-700 font-medium">{piDays < 0 ? "Expired" : `${piDays}d left`}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Registration/CPD renewal:</span>
                <input
                  type="date"
                  value={c.registrationExpiry}
                  onChange={(e) => onSetExpiry(c.id, "registrationExpiry", e.target.value)}
                  className={`px-2 py-1 rounded border text-xs ${regWarn ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}
                />
                {regWarn && <span className="text-amber-700 font-medium">{regDays < 0 ? "Expired" : `${regDays}d left`}</span>}
              </div>
            </div>
          </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 -mt-4 mb-6 max-w-2xl">
        Signatures are stored for this session only, from the actual image file you select — no real persistence yet until the real build's file storage exists (see the build brief). Expiry dates within 30 days show as a dashboard task automatically.
      </p>

      <div className="bg-white rounded-lg border border-slate-200 max-w-2xl p-5 mb-10">
        <div className="font-bold text-teal-900 mb-3 text-sm">Add a certifier</div>
        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
          <input value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} placeholder="Registration no." className="px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
          <input value={registrationBody} onChange={(e) => setRegistrationBody(e.target.value)} placeholder="Registration body" className="px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
        </div>
        <button onClick={add} className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
          <Plus size={15} /> Add certifier
        </button>
      </div>

      <h2 className="text-xl font-bold text-teal-900 mb-1">Clients</h2>
      <p className="text-slate-500 text-sm mb-4 max-w-xl">
        Architects, builders, or owners who work with you across multiple jobs. Assign a client to a job (in the job's basics) and they'll see every job assigned to them together in their client portal, instead of one job at a time.
      </p>

      <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-w-2xl mb-6">
        <div className="bg-slate-800 text-white px-5 py-3 flex justify-between text-sm font-semibold">
          <span>Name</span>
          <span>Type</span>
        </div>
        {clients.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">No clients added yet.</div>
        ) : (
          clients.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <div>
                <div className="font-medium text-teal-900 text-sm">{c.name}</div>
                <div className="text-xs text-slate-400">{c.company || c.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{c.type}</span>
                <button onClick={() => onRemoveClient(c.id)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 max-w-2xl p-5">
        <div className="font-bold text-teal-900 mb-3 text-sm">Add a client</div>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Full name" className="px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
          <select value={clientType} onChange={(e) => setClientType(e.target.value)} className="px-3 py-2 rounded-md border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600">
            {CLIENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="Company (optional)" className="px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
          <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Email" className="px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
          <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Phone" className="px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
        </div>
        <button onClick={addClient} className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
          <Plus size={15} /> Add client
        </button>
      </div>
    </div>
  );
}

function ProjectList({ projects, certifiers, onSelect, onNewJob }) {
  const [query, setQuery] = useState("");
  const [certifierFilter, setCertifierFilter] = useState("");
  const filtered = projects.filter((p) => {
    if (query) {
      const haystack = `${p.address} ${p.description} ${p.details.projectNumber || ""} ${p.id}`.toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    if (certifierFilter && !jobCertifierNames(p).includes(certifierFilter)) return false;
    return true;
  });
  const needsAttention = (p) => {
    const all = [...p.checklists[p.pathway], ...p.checklists.NOC, ...p.checklists.OC];
    return all.some((i) => unresolvedCount(i) > 0);
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="px-6 py-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by job number or address"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
        <select
          value={certifierFilter}
          onChange={(e) => setCertifierFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-600"
        >
          <option value="">Approved by: Any certifier</option>
          {certifiers.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        {(query || certifierFilter) && (
          <button onClick={() => { setQuery(""); setCertifierFilter(""); }} className="text-sm text-slate-400 hover:text-slate-600 hover:underline">
            Clear
          </button>
        )}
        <button onClick={onNewJob} className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
          <Plus size={16} /> New job
        </button>
      </div>

      <div className="mx-6 mb-6 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white text-left">
              <th className="px-5 py-3 font-semibold">Address</th>
              <th className="px-5 py-3 font-semibold w-72">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} onClick={() => onSelect(p.id)} className="border-t border-slate-100 hover:bg-teal-50/60 cursor-pointer transition-colors">
                <td className="px-5 py-4 align-top">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-teal-900">{p.address}</span>
                    {p.status === "complete" && (
                      <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[11px] font-semibold">Completed</span>
                    )}
                    {needsAttention(p) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[11px] font-semibold">
                        <AlertTriangle size={11} /> Amendment needed
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 mt-0.5">{p.description}</div>
                </td>
                <td className="px-5 py-4 align-top">
                  <div className="flex gap-1.5 flex-wrap">
                    <StagePill label={p.pathway} done={stageComplete(p.checklists[p.pathway])} progress={checklistProgress(p.checklists[p.pathway])} />
                    <StagePill label="NOC" done={stageComplete(p.checklists.NOC)} progress={checklistProgress(p.checklists.NOC)} />
                    <StagePill label="INSP" done={inspectionsComplete(p)} progress={inspectionProgress(p)} />
                    <StagePill label="OC" done={stageComplete(p.checklists.OC)} progress={checklistProgress(p.checklists.OC)} />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-slate-400">
                  {activeQuery ? `No jobs match "${activeQuery}".` : 'No jobs yet. Click "New job" to create your first one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist item row
// ---------------------------------------------------------------------------

function ChecklistItemRow({ item, onUpload, onResubmit, onApprove, onReopen, onAddPoint, onTogglePoint, onRemovePoint, onSetDocMeta, onToggleStamping, onRemove }) {
  const [addingPoint, setAddingPoint] = useState(false);
  const [pointDraft, setPointDraft] = useState("");
  const [editingMeta, setEditingMeta] = useState(false);
  const [revDraft, setRevDraft] = useState(item.revision || "");
  const [docDateDraft, setDocDateDraft] = useState(item.documentDate || "");
  const [preparedByDraft, setPreparedByDraft] = useState(item.preparedBy || "");
  const [drawingNoDraft, setDrawingNoDraft] = useState(item.drawingNumber || "");
  const [clauseDraft, setClauseDraft] = useState(item.clauseRef || "");
  const meta = displayStatus(item);
  const amendments = item.amendments || [];
  const unresolved = unresolvedCount(item);
  const canApprove = item.status === "submitted" && unresolved === 0;

  const savePoint = () => {
    if (!pointDraft.trim()) return;
    onAddPoint(pointDraft.trim());
    setPointDraft("");
    setAddingPoint(false);
  };

  const saveMeta = () => {
    onSetDocMeta({ revision: revDraft.trim(), documentDate: docDateDraft.trim(), preparedBy: preparedByDraft.trim(), drawingNumber: drawingNoDraft.trim(), clauseRef: clauseDraft.trim() });
    setEditingMeta(false);
  };

  const hasMeta = item.revision || item.documentDate || item.preparedBy || item.drawingNumber || item.clauseRef;

  return (
    <div className="border-t border-slate-100 bg-white">
      <div className="flex items-start justify-between px-5 py-4">
        <div className="flex gap-3 max-w-2xl">
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
          <div>
            <div className="font-semibold text-teal-900">{item.title}</div>
            <div className="text-sm text-slate-500 mt-0.5">{item.desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 pl-4">
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {meta.label}
            {item.version > 1 && <span className="ml-1 text-slate-300">· v{item.version}</span>}
          </span>
          <button
            onClick={onToggleStamping}
            title={item.requiresStamping ? "Remove stamping requirement" : "Mark this document as requiring a stamp"}
            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold whitespace-nowrap ${
              item.requiresStamping ? "bg-teal-800 text-white border-teal-800" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <FileText size={11} /> Stamp
          </button>
          <button onClick={onRemove} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"><X size={14} /></button>
        </div>
      </div>

      <div className="px-5 pb-2 -mt-2 flex items-center gap-2 text-xs text-slate-400 flex-wrap">
        {editingMeta ? (
          <>
            <input value={drawingNoDraft} onChange={(e) => setDrawingNoDraft(e.target.value)} placeholder="Drawing no. (e.g. A03)" className="w-32 px-2 py-1 rounded border border-slate-200 text-xs" />
            <input value={revDraft} onChange={(e) => setRevDraft(e.target.value)} placeholder="Revision (e.g. B)" className="w-28 px-2 py-1 rounded border border-slate-200 text-xs" />
            <input value={docDateDraft} onChange={(e) => setDocDateDraft(e.target.value)} placeholder="Document date" className="w-32 px-2 py-1 rounded border border-slate-200 text-xs" />
            <input value={preparedByDraft} onChange={(e) => setPreparedByDraft(e.target.value)} placeholder="Prepared by" className="w-44 px-2 py-1 rounded border border-slate-200 text-xs" />
            <input value={clauseDraft} onChange={(e) => setClauseDraft(e.target.value)} placeholder="NCC/BCA clause (e.g. NCC 2022 Vol 2, 3.1)" className="w-56 px-2 py-1 rounded border border-slate-200 text-xs" />
            <button onClick={saveMeta} className="text-teal-700 font-semibold hover:underline">Save</button>
            <button onClick={() => setEditingMeta(false)} className="text-slate-400 hover:underline">Cancel</button>
          </>
        ) : (
          <>
            {hasMeta ? (
              <span>
                {item.drawingNumber && <>No. {item.drawingNumber}</>}
                {item.revision && <> · Rev {item.revision}</>}
                {item.documentDate && <> · Dated {item.documentDate}</>}
                {item.preparedBy && <> · Prepared by {item.preparedBy}</>}
                {item.clauseRef && <> · Assessed against {item.clauseRef}</>}
              </span>
            ) : (
              <span className="italic">No drawing no./revision/date/preparer/clause recorded</span>
            )}
            <button onClick={() => setEditingMeta(true)} className="text-teal-700 hover:underline">Edit</button>
          </>
        )}
      </div>

      {amendments.length > 0 && (
        <div className={`mx-5 mb-4 -mt-1 rounded-md px-3.5 py-3 border ${unresolved > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
          <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-2 ${unresolved > 0 ? "text-amber-800" : "text-emerald-700"}`}>
            {unresolved > 0 ? <AlertTriangle size={13} /> : <Check size={13} />}
            {unresolved > 0 ? `Amendment${amendments.length > 1 ? "s" : ""} requested (${unresolved} open)` : "All amendment points resolved — ready to approve"}
          </div>
          <ul className="space-y-1.5">
            {amendments.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <button onClick={() => onTogglePoint(a.id)} className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${a.resolved ? "bg-emerald-600 border-emerald-600" : "border-amber-400 bg-white"}`}>
                  {a.resolved && <Check size={11} className="text-white" />}
                </button>
                <span className={`text-sm flex-1 ${a.resolved ? "text-slate-400 line-through" : "text-amber-900"}`}>{a.text}</span>
                <button onClick={() => onRemovePoint(a.id)} className="text-amber-400 hover:text-amber-700 shrink-0"><X size={13} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {addingPoint && (
        <div className="mx-5 mb-4 -mt-1 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-3">
          <textarea value={pointDraft} onChange={(e) => setPointDraft(e.target.value)} rows={2} placeholder="Describe one specific change, e.g. 'Rear setback shown as 850mm — 900mm minimum required.'" className="w-full px-2.5 py-2 rounded-md border border-amber-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" autoFocus />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setAddingPoint(false)} className="px-3 py-1.5 rounded-md text-xs text-slate-500 hover:bg-white">Cancel</button>
            <button onClick={savePoint} className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700">Add point</button>
          </div>
        </div>
      )}

      <div className="px-5 pb-4 -mt-1 flex gap-2 flex-wrap">
        {item.status === "requested" && (
          <button onClick={onUpload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50">
            <UploadCloud size={14} /> Mark as received (upload on client's behalf)
          </button>
        )}
        {item.status === "submitted" && (
          <>
            {canApprove && (
              <button onClick={onApprove} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-200 text-sm text-emerald-700 font-medium hover:bg-emerald-50">
                <Check size={14} /> Approve
              </button>
            )}
            {unresolved > 0 && (
              <button onClick={onResubmit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50">
                <UploadCloud size={14} /> Mark revised document as received
              </button>
            )}
            {!addingPoint && (
              <button onClick={() => setAddingPoint(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-200 text-sm text-amber-700 font-medium hover:bg-amber-50">
                <Plus size={14} /> {amendments.length > 0 ? "Add another point" : "Request amendment"}
              </button>
            )}
            {unresolved > 0 && <span className="flex items-center px-3 py-1.5 text-xs text-slate-400">Resolve all points before approving</span>}
          </>
        )}
        {item.status === "approved" && (
          <button onClick={onReopen} className="text-xs text-slate-400 hover:text-slate-600 hover:underline">Reopen</button>
        )}
      </div>
    </div>
  );
}

// A single checklist stage — no dropdown, since each stage is now its own
// top-level tab on the job page.
function SingleChecklistView({ project, stageKey, stageLabel, onAddItems, onUploadItem, onResubmitItem, onApproveItem, onReopenItem, onAddPoint, onTogglePoint, onRemovePoint, onSetDocMeta, onRemoveItem }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const items = project.checklists[stageKey] || [];
  const doneCount = items.filter((i) => i.status === "approved").length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const library = DOC_LIBRARY[stageKey] || DOC_LIBRARY[project.pathway] || [];

  return (
    <div className="px-6 py-6">
      <h2 className="text-2xl font-bold text-teal-900 mb-1">{stageLabel}</h2>

      <div className="mt-4 mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-md flex-1">
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-teal-700 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 text-sm text-teal-800 font-medium">
            {items.length === 0 ? "No documents requested yet" : pct === 100 ? "All items approved" : "In progress"}{" "}
            {items.length > 0 && <span className="text-slate-400 font-normal">{doneCount}/{items.length} ({pct}%)</span>}
          </div>
        </div>
        <button onClick={() => setPickerOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 whitespace-nowrap">
          <Plus size={15} /> Request document
        </button>
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-lg py-10 text-center text-slate-400 text-sm">
          Nothing requested for this stage yet — click "Request document" to build the checklist.
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden border border-slate-200">
          <div className="bg-slate-800 text-white px-5 py-3 flex justify-between text-sm font-semibold">
            <span>Item</span>
            <span>Status</span>
          </div>
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              onUpload={() => onUploadItem(stageKey, item.id)}
              onResubmit={() => onResubmitItem(stageKey, item.id)}
              onApprove={() => onApproveItem(stageKey, item.id)}
              onReopen={() => onReopenItem(stageKey, item.id)}
              onAddPoint={(text) => onAddPoint(stageKey, item.id, text)}
              onTogglePoint={(pointId) => onTogglePoint(stageKey, item.id, pointId)}
              onRemovePoint={(pointId) => onRemovePoint(stageKey, item.id, pointId)}
              onSetDocMeta={(patch) => onSetDocMeta(stageKey, item.id, patch)}
              onToggleStamping={() => onSetDocMeta(stageKey, item.id, { requiresStamping: !item.requiresStamping })}
              onRemove={() => onRemoveItem(stageKey, item.id)}
            />
          ))}
        </div>
      )}

      {pickerOpen && (
        <PickerModal title={`Request documents — ${stageLabel}`} library={library} existingTitles={items.map((i) => i.title)} onAdd={(newItems) => onAddItems(stageKey, newItems)} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

// The "Prior to Issuance of CDC/CC" tab — also where any modification
// checklists live, via a small secondary selector, since a modification is
// logically nested under the original certificate, not its own top-level
// stage on the job page.
function PriorCdcTab({ project, initialModId, ...checklistHandlers }) {
  const [activeModId, setActiveModId] = useState(initialModId || null);
  const mods = project.certificateRecords.pathway.modifications;
  const stageKey = activeModId || project.pathway;
  const modIndex = mods.findIndex((m) => m.id === activeModId);
  const stageLabel = activeModId ? `Modification ${modIndex + 1}` : `Prior to Issuance of ${project.pathway}`;

  return (
    <div>
      {mods.length > 0 && (
        <div className="px-6 pt-5 flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveModId(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${!activeModId ? "bg-teal-800 text-white border-teal-800" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
          >
            Original {project.pathway}
          </button>
          {mods.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => setActiveModId(m.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${activeModId === m.id ? "bg-teal-800 text-white border-teal-800" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
            >
              Modification {idx + 1}
            </button>
          ))}
        </div>
      )}
      <SingleChecklistView project={project} stageKey={stageKey} stageLabel={stageLabel} {...checklistHandlers} />
    </div>
  );
}

function InspectionPhotos({ insp, onAddPhotos, onRemovePhoto, onSetPhotoCaption }) {
  const photos = insp.photos || [];
  const fileInputRef = useRef(null);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Photos {photos.length > 0 && `(${photos.length})`}</span>
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-xs text-teal-700 font-medium hover:underline">
          <UploadCloud size={12} /> Add photos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAddPhotos([...e.target.files]);
            e.target.value = "";
          }}
        />
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative group">
              <img src={p.url} alt={p.caption || p.fileName} className="w-full aspect-square object-cover rounded-md border border-slate-200" />
              <button onClick={() => onRemovePhoto(p.id)} className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-slate-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={12} />
              </button>
              <input
                value={p.caption}
                onChange={(e) => onSetPhotoCaption(p.id, e.target.value)}
                placeholder="Caption"
                className="w-full mt-1 px-1.5 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InspectionRow({ insp, certifiers, onSetOutcome, onAddDefect, onToggleDefect, onRemoveDefect, onSetInspector, onSetDate, onOpenReport, onRemove, onAddPhotos, onRemovePhoto, onSetPhotoCaption, onConfirmBooking }) {
  const [addingDefect, setAddingDefect] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState(null); // "failed" | "passed_subject_to"
  const [defectDraft, setDefectDraft] = useState("");
  const defects = insp.defects || [];
  const unresolved = defects.filter((d) => !d.resolved).length;
  const isConditional = insp.outcome === "passed_subject_to";

  const saveDefect = () => {
    if (!defectDraft.trim()) return;
    onAddDefect(defectDraft.trim());
    setDefectDraft("");
  };

  const startFlag = (outcome) => {
    setPendingOutcome(outcome);
    setAddingDefect(true);
  };

  const confirmFlag = () => {
    saveDefect();
    onSetOutcome(pendingOutcome);
    setAddingDefect(false);
    setPendingOutcome(null);
  };

  const currentCertifierId = certifiers.find((c) => c.name === insp.inspectorName)?.id || certifiers[0]?.id;
  const selectInspector = (certifierId) => {
    const c = certifiers.find((x) => x.id === certifierId);
    if (c) onSetInspector(c.name, c.registrationNo);
  };

  const outcomeMeta =
    insp.outcome === "passed"
      ? { dot: "bg-emerald-600", label: "Passed", badge: "bg-emerald-50 text-emerald-700" }
      : insp.outcome === "failed"
      ? { dot: "bg-red-500", label: `Failed (${unresolved} open)`, badge: "bg-red-50 text-red-700" }
      : isConditional
      ? { dot: "bg-amber-500", label: `Passed subject to (${unresolved} open)`, badge: "bg-amber-50 text-amber-700" }
      : { dot: "bg-slate-300", label: "Not yet inspected", badge: "bg-slate-100 text-slate-500" };

  const listLabel = insp.outcome === "failed" ? "Defects" : "Conditions to satisfy";
  const listColor = insp.outcome === "failed" ? "red" : "amber";

  return (
    <div className="border-t border-slate-100 bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${outcomeMeta.dot}`} />
          <span className="font-semibold text-teal-900">{insp.title}</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${outcomeMeta.badge}`}>{outcomeMeta.label}</span>
        </div>
        <div className="flex items-center gap-3">
          {insp.date && <span className="text-sm text-slate-500">{formatISODate(insp.date)}</span>}
          <button onClick={onRemove} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"><X size={14} /></button>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400 flex-wrap">
        <span>Inspector:</span>
        <select
          value={currentCertifierId || ""}
          onChange={(e) => selectInspector(e.target.value)}
          className="px-2 py-1 rounded border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          {certifiers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.registrationNo})</option>
          ))}
        </select>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400 flex-wrap">
        <span>Date of inspection:</span>
        <input type="date" value={insp.date || ""} onChange={(e) => onSetDate(e.target.value)} className="px-2 py-1 rounded border border-slate-200 text-xs" />
        {insp.date && [0, 6].includes(new Date(insp.date + "T00:00:00").getDay()) && (
          <span className="text-amber-600 font-medium">⚠ This date falls on a weekend — inspections aren't carried out on weekends.</span>
        )}
      </div>

      {insp.bookedByClient && !insp.confirmed && (
        <div className="mt-2 flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <span className="text-xs text-amber-800 font-medium">Client booked this for {insp.date} — needs your confirmation</span>
          <button onClick={onConfirmBooking} className="px-2.5 py-1 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 whitespace-nowrap">
            Confirm
          </button>
        </div>
      )}
      {insp.bookedByClient && insp.confirmed && (
        <div className="mt-2 text-xs text-emerald-700 flex items-center gap-1"><Check size={12} /> Booking confirmed for {insp.date}</div>
      )}

      {defects.length > 0 && (
        <div className={`mt-3 bg-${listColor}-50 border border-${listColor}-200 rounded-md px-3.5 py-3`}>
          <div className={`text-xs font-bold text-${listColor}-800 uppercase tracking-wide mb-2`}>{listLabel} ({unresolved} open)</div>
          <ul className="space-y-1.5">
            {defects.map((d) => (
              <li key={d.id} className="flex items-start gap-2">
                <button onClick={() => onToggleDefect(d.id)} className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${d.resolved ? "bg-emerald-600 border-emerald-600" : `border-${listColor}-400 bg-white`}`}>
                  {d.resolved && <Check size={11} className="text-white" />}
                </button>
                <span className={`text-sm flex-1 ${d.resolved ? "text-slate-400 line-through" : `text-${listColor}-900`}`}>{d.text}</span>
                <button onClick={() => onRemoveDefect(d.id)} className={`text-${listColor}-400 hover:text-${listColor}-700 shrink-0`}><X size={13} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {addingDefect && (
        <div className={`mt-3 bg-${pendingOutcome === "failed" ? "red" : "amber"}-50 border border-${pendingOutcome === "failed" ? "red" : "amber"}-200 rounded-md px-3.5 py-3`}>
          <textarea
            value={defectDraft}
            onChange={(e) => setDefectDraft(e.target.value)}
            rows={2}
            placeholder={pendingOutcome === "failed" ? "Describe the defect, e.g. 'Waterproofing membrane not turned up 150mm at shower recess.'" : "Describe the condition to satisfy, e.g. 'Provide engineer's certification for tie-down prior to next stage.'"}
            className="w-full px-2.5 py-2 rounded-md border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => { setAddingDefect(false); setPendingOutcome(null); }} className="px-3 py-1.5 rounded-md text-xs text-slate-500 hover:bg-white">Cancel</button>
            <button onClick={confirmFlag} className={`px-3 py-1.5 rounded-md text-white text-xs font-semibold ${pendingOutcome === "failed" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}>
              {pendingOutcome === "failed" ? "Record defect & fail inspection" : "Record condition & pass subject to"}
            </button>
          </div>
        </div>
      )}

      <InspectionPhotos insp={insp} onAddPhotos={onAddPhotos} onRemovePhoto={onRemovePhoto} onSetPhotoCaption={onSetPhotoCaption} />

      <div className="flex gap-2 flex-wrap mt-3">
        {insp.outcome === "pending" && !addingDefect && (
          <>
            <button onClick={() => onSetOutcome("passed")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-200 text-sm text-emerald-700 font-medium hover:bg-emerald-50">
              <Check size={14} /> Mark passed
            </button>
            <button onClick={() => startFlag("passed_subject_to")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-200 text-sm text-amber-700 font-medium hover:bg-amber-50">
              <AlertTriangle size={14} /> Pass subject to...
            </button>
            <button onClick={() => startFlag("failed")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 text-sm text-red-700 font-medium hover:bg-red-50">
              <AlertTriangle size={14} /> Mark failed
            </button>
          </>
        )}
        {(insp.outcome === "failed" || isConditional) && !addingDefect && (
          <button onClick={() => startFlag(insp.outcome)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium ${insp.outcome === "failed" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-amber-200 text-amber-700 hover:bg-amber-50"}`}>
            <Plus size={14} /> {insp.outcome === "failed" ? "Add another defect" : "Add another condition"}
          </button>
        )}
        {(insp.outcome === "failed" || isConditional) && unresolved === 0 && (
          <button onClick={() => onSetOutcome("passed")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-200 text-sm text-emerald-700 font-medium hover:bg-emerald-50">
            <Check size={14} /> All items resolved — mark fully passed
          </button>
        )}
        {insp.outcome !== "pending" && (
          <button onClick={onOpenReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50">
            <FileText size={14} /> {insp.reportSent ? `Report sent ${insp.reportSentDate} — view` : "View / send inspection report"}
          </button>
        )}
      </div>
    </div>
  );
}

function InspectionsTab({ project, certifiers, onSetOutcome, onAddDefect, onToggleDefect, onRemoveDefect, onSetInspector, onSetDate, onSendReport, onReportPortal, onRemoveInspection, onAddPhotos, onRemovePhoto, onSetPhotoCaption, onConfirmBooking }) {
  const [reportInspId, setReportInspId] = useState(null);
  const items = project.inspections;
  const reportInsp = items.find((i) => i.id === reportInspId);

  return (
    <div className="px-6 py-6">
      <h2 className="text-2xl font-bold text-teal-900 mb-4">Inspections</h2>

      {items.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-lg py-10 text-center text-slate-400 text-sm">
          No inspections on this job.
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden border border-slate-200">
          <div className="bg-slate-800 text-white px-5 py-3 text-sm font-semibold">Inspections</div>
          {items.map((insp) => (
            <InspectionRow
              key={insp.id}
              insp={insp}
              certifiers={certifiers}
              onSetOutcome={(outcome) => onSetOutcome(insp.id, outcome)}
              onAddDefect={(text) => onAddDefect(insp.id, text)}
              onToggleDefect={(id) => onToggleDefect(insp.id, id)}
              onRemoveDefect={(id) => onRemoveDefect(insp.id, id)}
              onSetInspector={(name, license) => onSetInspector(insp.id, name, license)}
              onSetDate={(isoDate) => onSetDate(insp.id, isoDate)}
              onOpenReport={() => setReportInspId(insp.id)}
              onRemove={() => onRemoveInspection(insp.id)}
              onAddPhotos={(files) => onAddPhotos(insp.id, files)}
              onRemovePhoto={(photoId) => onRemovePhoto(insp.id, photoId)}
              onSetPhotoCaption={(photoId, caption) => onSetPhotoCaption(insp.id, photoId, caption)}
              onConfirmBooking={() => onConfirmBooking(insp.id)}
            />
          ))}
        </div>
      )}

      {reportInsp && (
        <InspectionReportModal project={project} inspection={reportInsp} onSend={() => onSendReport(reportInsp.id)} onReportPortal={() => onReportPortal(reportInsp.id)} certifiers={certifiers} onClose={() => setReportInspId(null)} />
      )}
    </div>
  );
}

function ApprovalsTab({ project, certifiers, onGenerate, onUploadApproval, onCreateModification, onGenerateModification, onIssueOC, onUploadOCApproval, onGoToChecklist, onToggleCriticalStageInspection, onSaveCouncilLetter, onSaveApplicantLetter }) {
  const [certView, setCertView] = useState(null); // { variant, record, certRef } | null
  const [letterView, setLetterView] = useState(null); // "council" | "applicant" | "inspectionsNotice" | null
  const defaultCertId = project.certifierId || certifiers[0]?.id;
  const [pathwayCertifier, setPathwayCertifier] = useState(defaultCertId);
  const [determinationDate, setDeterminationDate] = useState(project.details.certificateDetails.determinationDate || todayISO());
  const [modOpen, setModOpen] = useState(false);
  const [modReason, setModReason] = useState("");
  const [modCertifiers, setModCertifiers] = useState({}); // { [modId]: certifierId }
  const [ocOpen, setOcOpen] = useState(null); // "partial" | "whole" | null
  const [ocDescription, setOcDescription] = useState("");
  const [ocCertifier, setOcCertifier] = useState(defaultCertId);

  const pathRec = project.certificateRecords.pathway;
  const pathReady = stageComplete(project.checklists[project.pathway]);
  const ocChecklistReady = stageComplete(project.checklists.OC);
  const records = ocRecords(project);
  // Two clean, separate pages instead of one long scroll — OC only becomes
  // reachable once the CDC/CC is actually issued.
  const [page, setPage] = useState("pathway"); // "pathway" | "oc"
  const activePage = pathwayIssued(project) ? page : "pathway";

  const createModification = () => {
    if (!modReason.trim()) return;
    onCreateModification(modReason.trim());
    setModReason("");
    setModOpen(false);
  };

  const issueOC = (type) => {
    onIssueOC(type, ocDescription.trim(), ocCertifier);
    setOcDescription("");
    setOcOpen(null);
  };

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-teal-900">Certificates</h2>
        {pathwayIssued(project) && (
          <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm">
            <button
              onClick={() => setPage("pathway")}
              className={`px-4 py-1.5 font-medium ${activePage === "pathway" ? "bg-teal-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              {project.pathway}
            </button>
            <button
              onClick={() => setPage("oc")}
              className={`px-4 py-1.5 font-medium ${activePage === "oc" ? "bg-teal-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              Occupation Certificate
            </button>
          </div>
        )}
      </div>

      {activePage === "pathway" && (
      <>
      {/* --- Pathway certificate (CDC/CC) --- */}
      <div className="rounded-lg overflow-hidden border border-slate-200 mb-3">
        <div className="bg-slate-800 text-white px-5 py-3 text-sm font-semibold">{project.pathway} Certificate</div>
        <div className="px-5 py-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-teal-900">{project.pathway} Certificate</div>
              {!pathReady && <div className="text-xs text-slate-400 mt-0.5">Available once every document on that checklist is approved.</div>}
              {pathReady && !pathRec.generated && <div className="text-xs text-teal-600 mt-0.5">Checklist complete — ready to generate.</div>}
              {pathRec.generated && (
                <div className="text-xs text-slate-500 mt-0.5">
                  Issued by {pathRec.issuedBy?.name || FIRM.certifierName} · Generated {pathRec.generatedDate} (v{pathRec.version || 1})
                  {pathRec.approvalUploaded ? ` · Signed approval uploaded ${pathRec.approvalDate} · Visible to client` : " · Awaiting signed approval upload"}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pathRec.generated && (
                <button
                  onClick={() => setCertView({ variant: "pathway", record: pathRec, certRef: pathwayCertRef(project) })}
                  className="px-3.5 py-2 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50"
                >
                  View certificate
                </button>
              )}              {pathRec.generated && !pathRec.approvalUploaded && (
                <button onClick={() => onUploadApproval()} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50">
                  <UploadCloud size={14} /> Upload signed approval
                </button>
              )}
              {pathRec.approvalUploaded && (
              <span className="flex items-center gap-1.5 px-3 py-2 text-sm text-emerald-700 font-medium">
                <Check size={14} /> Approval on file
              </span>
            )}
            {pathRec.generated && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">Regenerate:</span>
                <select value={pathwayCertifier} onChange={(e) => { setPathwayCertifier(e.target.value); onGenerate(e.target.value, determinationDate); }} className="px-2 py-2 rounded-md border border-slate-200 text-xs text-slate-600 bg-white focus:outline-none" title="Regenerate certificate — useful if a mistake needs correcting">
                  {certifiers.map((c) => (
                    <option key={c.id} value={c.id}>as {c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {pathRec.generated && (
          <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 mr-1">Correspondence:</span>
            <button onClick={() => setLetterView("package")} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900">
              View full certificate package
            </button>
            <span className="text-slate-200">|</span>
            <button onClick={() => setLetterView("council")} className="px-3 py-1.5 rounded-md border border-slate-200 text-xs text-teal-800 font-medium hover:bg-slate-50">
              Council notification letter
            </button>
            <button onClick={() => setLetterView("applicant")} className="px-3 py-1.5 rounded-md border border-slate-200 text-xs text-teal-800 font-medium hover:bg-slate-50">
              Applicant notification letter
            </button>
            <button onClick={() => setLetterView("inspectionsNotice")} className="px-3 py-1.5 rounded-md border border-slate-200 text-xs text-teal-800 font-medium hover:bg-slate-50">
              Notice of mandatory inspections
            </button>
          </div>
        )}
        {pathRec.generated && (
          <div className="border-t border-slate-100 px-5 py-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Which critical stage inspections apply to this job?</div>
            <div className="flex flex-wrap gap-2">
              {MANDATORY_CRITICAL_STAGE_INSPECTIONS.map((insp) => {
                const active = (project.criticalStageInspections || []).includes(insp.no);
                return (
                  <button
                    key={insp.no}
                    onClick={() => onToggleCriticalStageInspection(insp.no)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active ? "bg-teal-800 text-white border-teal-800" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                    title={insp.stage}
                  >
                    {insp.no}. {insp.stage.length > 40 ? insp.stage.slice(0, 40) + "…" : insp.stage}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-slate-400 mt-2">Unticking one removes it from Schedule 1 of the mandatory inspections notice — only untick if it genuinely doesn't apply to this job.</div>
          </div>
        )}
        </div>

        {pathReady && !pathRec.generated && (
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">Date of Determination</div>
                <input type="date" value={determinationDate} onChange={(e) => setDeterminationDate(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
              </div>
              {project.pathway === "CDC" && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Date of Lapse <span className="text-slate-400">(automatic — 5 years from determination)</span></div>
                  <div className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-slate-100 text-slate-600">
                    {determinationDate ? addYears(determinationDate, 5) : "Enter Date of Determination first"}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select value={pathwayCertifier} onChange={(e) => setPathwayCertifier(e.target.value)} className="px-2.5 py-2 rounded-md border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600">
                {certifiers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                disabled={!determinationDate}
                onClick={() => onGenerate(pathwayCertifier, determinationDate)}
                className="px-3.5 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate certificate
              </button>
            </div>
          </div>
        )}

        {pathRec.generated && (
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Modifications</span>
              {!modOpen && (
                <button onClick={() => setModOpen(true)} className="flex items-center gap-1 text-xs text-teal-700 font-medium hover:underline">
                  <Plus size={12} /> Start a modified {project.pathway}
                </button>
              )}
            </div>

            {pathRec.modifications.length === 0 && !modOpen && <div className="text-xs text-slate-400 mt-1">None yet.</div>}

            {pathRec.modifications.map((m, idx) => {
              const modChecklist = project.checklists[m.id] || [];
              const complete = stageComplete(modChecklist);
              const prog = checklistProgress(modChecklist);
              const certForMod = modCertifiers[m.id] || defaultCertId;
              return (
                <div key={m.id} className="mt-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-teal-900">Modification {idx + 1}</span>
                      <span className="text-slate-400 text-xs ml-2">{m.reason}</span>
                    </div>
                    {m.generated ? (
                      <button
                        onClick={() => setCertView({ variant: "pathway_mod", record: m, certRef: `${project.pathway}-${project.details.projectNumber || project.id.toUpperCase()}-MOD${idx + 1}` })}
                        className="text-xs text-teal-700 font-medium hover:underline"
                      >
                        View
                      </button>
                    ) : (
                      <span className={`text-xs font-semibold ${complete ? "text-emerald-600" : "text-slate-400"}`}>Checklist {prog}</span>
                    )}
                  </div>
                  {!m.generated && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <button onClick={() => onGoToChecklist(m.id)} className="px-3 py-1.5 rounded-md border border-slate-200 text-xs text-teal-800 font-medium hover:bg-white bg-white">
                        {complete ? "Review checklist" : "Build checklist — request updated documents"}
                      </button>
                      {complete && (
                        <>
                          <select
                            value={certForMod}
                            onChange={(e) => setModCertifiers((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            className="px-2 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:outline-none"
                          >
                            {certifiers.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <button onClick={() => onGenerateModification(m.id, certForMod)} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900">
                            Issue modification
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {modOpen && (
              <div className="mt-2 bg-white border border-slate-200 rounded-md p-3">
                <textarea
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                  rows={2}
                  placeholder="Reason for modification, e.g. 'Amend approved plans to relocate window on southern elevation.'"
                  className="w-full px-2.5 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setModOpen(false)} className="px-3 py-1.5 rounded-md text-xs text-slate-500 hover:bg-slate-50">Cancel</button>
                  <button onClick={createModification} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900">Create checklist</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {activePage === "oc" && (
      <>
      {/* --- Occupation Certificates (partial/whole) --- */}
      <div className="rounded-lg overflow-hidden border border-slate-200 mb-6">
        <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between text-sm font-semibold">
          <span>Occupation Certificates</span>
        </div>
        {!pathwayIssued(project) && <div className="px-5 py-4 text-sm text-slate-400 bg-white">Locked until the {project.pathway} certificate is issued.</div>}
        {pathwayIssued(project) && !ocChecklistReady && <div className="px-5 py-4 text-sm text-slate-400 bg-white">Available once every document on the OC checklist is approved.</div>}

        {pathwayIssued(project) && ocChecklistReady && (
          <>
            {records.length === 0 && <div className="px-5 py-4 text-sm text-teal-600 bg-white">OC checklist complete — ready to issue a Partial or Whole OC.</div>}
            {records.map((r, idx) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-white">
                <div>
                  <div className="font-semibold text-teal-900">
                    OC {idx + 1} — {r.type === "whole" ? "Whole" : "Partial"}
                    {r.type === "partial" && r.description && <span className="text-slate-400 font-normal"> ({r.description})</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Issued by {r.issuedBy?.name} · Generated {r.generatedDate}
                    {r.approvalUploaded ? ` · Signed approval uploaded ${r.approvalDate} · Visible to client` : " · Awaiting signed approval upload"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCertView({ variant: "oc", record: r, certRef: `OC-${project.details.projectNumber || project.id.toUpperCase()}/${String(idx + 1).padStart(2, "0")}` })}
                    className="px-3.5 py-2 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50"
                  >
                    View certificate
                  </button>
                  {!r.approvalUploaded && (
                    <button onClick={() => onUploadOCApproval(r.id)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50">
                      <UploadCloud size={14} /> Upload signed approval
                    </button>
                  )}
                  {r.approvalUploaded && (
                    <span className="flex items-center gap-1.5 px-3 py-2 text-sm text-emerald-700 font-medium">
                      <Check size={14} /> On file
                    </span>
                  )}
                </div>
              </div>
            ))}

            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
              {ocOpen ? (
                <div className="bg-white border border-slate-200 rounded-md p-3">
                  <div className="text-xs font-semibold text-slate-600 mb-2">
                    Issuing a {ocOpen === "whole" ? "Whole" : "Partial"} Occupation Certificate
                  </div>
                  {ocOpen === "partial" && (
                    <input
                      value={ocDescription}
                      onChange={(e) => setOcDescription(e.target.value)}
                      placeholder="Scope, e.g. 'Units 1–4 only'"
                      className="w-full mb-2 px-2.5 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <select value={ocCertifier} onChange={(e) => setOcCertifier(e.target.value)} className="px-2.5 py-1.5 rounded-md border border-slate-200 text-sm bg-white focus:outline-none">
                      {certifiers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => setOcOpen(null)} className="px-3 py-1.5 rounded-md text-xs text-slate-500 hover:bg-slate-50">Cancel</button>
                      <button onClick={() => issueOC(ocOpen)} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900">Issue OC</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setOcOpen("partial")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50">
                    <Plus size={14} /> Issue Partial OC
                  </button>
                  <button onClick={() => setOcOpen("whole")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
                    <Plus size={14} /> Issue Whole OC
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      </>
      )}

      {certView && <CertificateModal project={project} variant={certView.variant} record={certView.record} certRef={certView.certRef} certifiers={certifiers} onClose={() => setCertView(null)} />}
      {letterView === "council" && (
        <CouncilLetterModal
          project={project}
          record={pathRec}
          certRef={pathwayCertRef(project)}
          certifiers={certifiers}
          onSaveOverride={onSaveCouncilLetter}
          onClose={() => setLetterView(null)}
        />
      )}
      {letterView === "applicant" && (
        <ApplicantLetterModal
          project={project}
          record={pathRec}
          certRef={pathwayCertRef(project)}
          certifiers={certifiers}
          onSaveOverride={onSaveApplicantLetter}
          onClose={() => setLetterView(null)}
        />
      )}
      {letterView === "inspectionsNotice" && (
        <InspectionsNoticeModal
          project={project}
          record={pathRec}
          certRef={pathwayCertRef(project)}
          certifiers={certifiers}
          onClose={() => setLetterView(null)}
        />
      )}
      {letterView === "package" && (
        <CertificatePackageModal
          project={project}
          record={pathRec}
          certRef={pathwayCertRef(project)}
          certifiers={certifiers}
          onClose={() => setLetterView(null)}
        />
      )}

      <p className="text-center text-xs text-slate-400 mt-8">Liability limited by a scheme approved under Professional Standards Legislation.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details tab — read-only view of the intake form, editable any time
// ---------------------------------------------------------------------------

function ReadRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-1.5">
      <span className="text-xs text-slate-400 sm:w-48 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-medium">{value}</span>
    </div>
  );
}

function ReadSection({ title, children }) {
  const hasContent = Array.isArray(children) ? children.some(Boolean) : !!children;
  if (!hasContent) return null;
  return (
    <div className="bg-white rounded-lg border border-slate-200 mb-5">
      <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">{title}</div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function formatAddress(a) {
  const parts = [a.streetNumber, a.street].filter(Boolean).join(" ");
  const rest = [a.suburb, a.state, a.postcode].filter(Boolean).join(" ");
  return [parts, rest].filter(Boolean).join(", ");
}

function DetailsTab({ project, onEdit, onAddCondition, onRemoveCondition }) {
  const d = project.details;
  const [conditionDraft, setConditionDraft] = useState("");
  const lapseDate = effectiveLapseDate(project);
  const hasAnyDetails =
    d.certificateDetails.lotSectionDp || d.projectNumber || d.zoning || d.bcaVersion || d.contact.nameOrCompany || d.council.lga || d.proposal.classifications.length > 0 || d.siteArea || d.buildingDescription;

  const addCondition = () => {
    if (!conditionDraft.trim()) return;
    onAddCondition(conditionDraft.trim());
    setConditionDraft("");
  };

  return (
    <div className="px-6 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-teal-900">Job Details</h2>
        <button onClick={onEdit} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50">
          <Pencil size={14} /> {hasAnyDetails ? "Edit details" : "Add details"}
        </button>
      </div>

      {!hasAnyDetails ? (
        <div className="border border-dashed border-slate-200 rounded-lg py-10 text-center text-slate-400 text-sm">
          No intake details captured yet. Click "Add details" to record project configuration, contacts, council and proposal information before issuing the {project.pathway}.
        </div>
      ) : (
        <>
          <ReadSection title="Project Configuration">
            <ReadRow label="Lot / Section / DP" value={d.certificateDetails.lotSectionDp} />
            <ReadRow label="Project number" value={d.projectNumber} />
            <ReadRow label="Zoning" value={d.zoning} />
            <ReadRow label="BCA/NCC Version" value={d.bcaVersion} />
          </ReadSection>

          <ReadSection title="Company / Primary contact">
            <ReadRow label="Name / company" value={d.contact.nameOrCompany} />
            <ReadRow label="Contact" value={[d.contact.title, d.contact.givenNames, d.contact.surname].filter(Boolean).join(" ")} />
            <ReadRow label="Phone" value={d.contact.phone} />
            <ReadRow label="Mobile" value={d.contact.mobile} />
            <ReadRow label="Email" value={d.contact.email} />
            <ReadRow label="Address" value={formatAddress(d.applicantAddress)} />
          </ReadSection>

          <ReadSection title="Owner details">
            <ReadRow label="Owner" value={d.ownerSameAsApplicant ? "Same as applicant" : d.owner.name} />
            {!d.ownerSameAsApplicant && <ReadRow label="Address" value={formatAddress(d.owner.address)} />}
            {!d.ownerSameAsApplicant && <ReadRow label="Phone" value={d.owner.phone} />}
          </ReadSection>

          <ReadSection title={`${project.pathway} Certificate Details`}>
            <ReadRow label="NSW Planning Portal Ref" value={d.certificateDetails.planningPortalRef} />
            <ReadRow label="Relevant EPI" value={d.certificateDetails.relevantInstrument} />
            <ReadRow label="Relevant Part of Code" value={d.certificateDetails.relevantPartOfCode} />
            <ReadRow label="Date of Determination" value={d.certificateDetails.determinationDate} />
            {project.pathway === "CDC" && lapseDate && <ReadRow label="Date of Lapse" value={`${lapseDate} (5 years from determination)`} />}
          </ReadSection>

          <ReadSection title="Council">
            <ReadRow label="Local Government Area" value={d.council.lga} />
            <ReadRow label="Address" value={formatAddress(d.council.address)} />
            <ReadRow label="Phone" value={d.council.contact.phone} />
            <ReadRow label="Email" value={d.council.contact.email} />
          </ReadSection>

          <ReadSection title="Proposal Details">
            <ReadRow label="Building classification(s)" value={d.proposal.classifications.join(", ")} />
            <ReadRow label="Construction type" value={d.proposal.constructionType !== "N/A" ? d.proposal.constructionType : ""} />
            <ReadRow label="Dwellings (existing / demolished / new)" value={[d.proposal.dwellingsExisting, d.proposal.dwellingsDemolished, d.proposal.dwellingsNew].some(Boolean) ? `${d.proposal.dwellingsExisting || 0} / ${d.proposal.dwellingsDemolished || 0} / ${d.proposal.dwellingsNew || 0}` : ""} />
            <ReadRow label="Estimated cost" value={d.proposal.estimatedCost ? `$${Number(d.proposal.estimatedCost).toLocaleString()}` : ""} />
            <ReadRow label="Storeys (above / below / total)" value={[d.proposal.storeysAbove, d.proposal.storeysBelow, d.proposal.storeysTotal].some(Boolean) ? `${d.proposal.storeysAbove || 0} / ${d.proposal.storeysBelow || 0} / ${d.proposal.storeysTotal || 0}` : ""} />
            <ReadRow label="Effective height" value={d.proposal.effectiveHeight ? `${d.proposal.effectiveHeight} m` : ""} />
            <ReadRow label="Floor area (existing / new)" value={d.proposal.floorAreaExisting || d.proposal.floorAreaNew ? `${d.proposal.floorAreaExisting || 0} m² / ${d.proposal.floorAreaNew || 0} m²` : ""} />
          </ReadSection>

          <ReadSection title="Proposal site">
            <ReadRow label="Total area of land" value={d.siteArea ? `${d.siteArea} m²` : ""} />
          </ReadSection>

          <ReadSection title="Building Description">
            <ReadRow label="Building description" value={d.buildingDescription} />
          </ReadSection>
        </>
      )}

      <div className="bg-white rounded-lg border border-slate-200 mb-5">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">Conditions of Consent</div>
        <div className="p-5">
          {project.conditions.length === 0 ? (
            <div className="text-sm text-slate-400 mb-3">No conditions entered yet. Add the conditions attached to the {project.pathway} approval — these will appear on the generated certificate.</div>
          ) : (
            <ul className="space-y-2 mb-4">
              {project.conditions.map((c, idx) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-slate-400 mt-0.5 w-5 shrink-0">{idx + 1}.</span>
                  <span className="text-sm text-slate-800 flex-1">{c.text}</span>
                  <button onClick={() => onRemoveCondition(c.id)} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 shrink-0"><X size={14} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              value={conditionDraft}
              onChange={(e) => setConditionDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCondition()}
              placeholder="e.g. Any Council fees/bonds must be paid prior to commencement of building works."
              className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <button onClick={addCondition} className="px-3 py-2 rounded-md bg-teal-800 text-white text-sm font-medium hover:bg-teal-900">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Certificate document — generated from job details + approved checklist items
// ---------------------------------------------------------------------------

function CertRow({ label, value }) {
  return (
    <tr className="align-top">
      <td className="py-1.5 pr-4 text-sm font-semibold text-slate-800 whitespace-nowrap w-1/3">{label}</td>
      <td className="py-1.5 text-sm text-slate-700">{value || "—"}</td>
    </tr>
  );
}

// Shared letterhead + print/export shell for the shorter correspondence
// documents (council/applicant letters, inspection notice) — same visual
// language as the certificate, without duplicating the toolbar each time.
function Letterhead() {
  return (
    <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
      <div>
        <div className="text-lg font-black tracking-tight">{FIRM.name}</div>
        <div className="text-[11px] text-slate-500">PTY LTD</div>
        <div className="text-xs text-slate-500 mt-1">ABN: {FIRM.abn}</div>
      </div>
      <div className="text-right text-xs text-slate-600 leading-relaxed">
        <div>Postal: {FIRM.postal}</div>
        <div>Office: {FIRM.office}</div>
        <div>(p): {FIRM.phone}</div>
        <div>(e): {FIRM.email}</div>
      </div>
    </div>
  );
}

// Shows the certifier's actual uploaded signature image once "Generate with
// signature" has been confirmed — otherwise a blank line, ready to sign by
// hand off a printed copy or after further edits in Word.
function SignatureBlock({ name, certifiers, showSignature }) {
  const cert = (certifiers || []).find((c) => c.name === name);
  if (showSignature && cert?.signatureUrl) {
    return <img src={cert.signatureUrl} alt={`${name} signature`} className="h-16 object-contain mb-1" />;
  }
  return <div className="pt-10 border-b border-slate-400 w-56" />;
}

// The combined certificate package: council letter, applicant letter,
// the certificate itself, the mandatory inspections notice, and a
// checklist summary — one document, in that exact order, one Print/Export
// action for the whole thing. Each section keeps its own letterhead and
// starts on a fresh page when printed.
function CertificatePackageModal({ project, record, certRef, certifiers, onClose }) {
  const contentRef = useRef(null);
  const projRef = certRef.split("/")[0];
  const [showSignature, setShowSignature] = useState(false);

  const Section = ({ children, last }) => (
    <div
      className={last ? "" : "pb-10 mb-10 border-b-2 border-dashed border-slate-200 print:border-0"}
      style={last ? undefined : { pageBreakAfter: "always", breakAfter: "page" }}
    >
      <Letterhead />
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-3 flex justify-between items-center print:hidden">
          <span className="text-sm font-semibold text-slate-600">Full certificate package</span>
          <div className="flex gap-2 items-center">
            <button onClick={() => setShowSignature((v) => !v)} className={`text-xs font-medium hover:underline mr-1 ${showSignature ? "text-emerald-700" : "text-teal-700"}`}>
              {showSignature ? "✓ Signed — back to draft" : "Generate with signature"}
            </button>
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
              Print / Save as PDF
            </button>
            <button
              onClick={() => {
                const clone = contentRef.current.cloneNode(true);
                clone.querySelectorAll("[data-stamp]").forEach((n) => n.remove());
                downloadAsWordDoc(`${projRef}-Certificate-Package.doc`, clone.innerHTML);
              }}
              className="px-3 py-1.5 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50"
            >
              Export as Word
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><X size={18} /></button>
          </div>
        </div>
        <div className="px-8 py-3 text-xs text-slate-400 print:hidden">
          1. Council letter · 2. Applicant letter · 3. Certificate &amp; schedule · 4. Mandatory inspections notice · 5. Checklist summary
        </div>

        <div className="p-8 text-slate-900" ref={contentRef}>
          <Section>
            <CouncilLetterBody project={project} record={record} certRef={certRef} certifiers={certifiers} showSignature={showSignature} />
          </Section>
          <Section>
            <ApplicantLetterBody project={project} record={record} certRef={certRef} certifiers={certifiers} showSignature={showSignature} />
          </Section>
          <Section>
            <CertificateBody project={project} variant="pathway" record={record} certRef={certRef} certifiers={certifiers} showSignature={showSignature} />
          </Section>
          <Section>
            <InspectionsNoticeBody project={project} record={record} certRef={certRef} certifiers={certifiers} showSignature={showSignature} />
          </Section>
          <Section last>
            <ChecklistSummaryBody project={project} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function LetterShell({ title, filename, children, onClose }) {
  const contentRef = useRef(null);
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-3 flex justify-between items-center print:hidden">
          <span className="text-sm font-semibold text-slate-600">{title}</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
              Print / Save as PDF
            </button>
            <button
              onClick={() => downloadAsWordDoc(filename, contentRef.current.innerHTML)}
              className="px-3 py-1.5 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50"
            >
              Export as Word
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><X size={18} /></button>
          </div>
        </div>
        <div className="p-8 text-slate-900" ref={contentRef}>
          <Letterhead />
          {children}
        </div>
      </div>
    </div>
  );
}

// Council notification letter — sent whenever a CDC/CC is issued.
// Read-only body content, reused inside the combined certificate package
// (which has its own single toolbar) and inside the standalone letter modal.
function CouncilLetterBody({ project, record, certRef, certifiers, showSignature }) {
  const d = project.details;
  const pathway = project.pathway;
  const pathwayFull = pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate";
  const issuer = record.issuedBy || { name: FIRM.certifierName, registrationNo: FIRM.certifierRego, registrationBody: FIRM.certifierBody };

  const defaultBody = [
    `${FIRM.name} Pty Ltd has issued a ${pathwayFull} under Part 4 of the Environmental Planning and Assessment Act 1979 for the above premises.`,
    `Please find enclosed the following documentation:\n- ${pathwayFull} No. ${certRef}\n- Copy of the application for the ${pathwayFull}.\n- Documentation used to determine the application for the ${pathwayFull} as detailed in Schedule 1 of the Certificate.`,
    ...(pathway === "CDC" ? ["The applicant / owner has been advised to submit the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site."] : []),
    `Should you need to discuss any issues, please do not hesitate to contact the Registered Building Surveyor ${issuer.name}.`,
  ].join("\n\n");
  const activeBody = project.councilLetterOverride || defaultBody;

  return (
    <div className="text-sm space-y-4">
      <div className="flex justify-between">
        <div>Our reference: {certRef.split("/")[0]}</div>
        <div>{record.generatedDate}</div>
      </div>
      <div>
        The General Manager<br />
        {d.council.lga || "Council"}<br />
        {formatAddress(d.council.address)}
      </div>
      <div>Dear Sir/Madam,</div>
      <div>
        <div><strong>Re:</strong> {project.address}</div>
        <div className="mt-2"><strong>{pathwayFull} No.</strong>&nbsp;&nbsp;{certRef}</div>
        <div className="mt-1"><strong>Planning Instrument Decision Made Under:</strong>&nbsp;&nbsp;{d.certificateDetails.relevantInstrument || "—"}</div>
      </div>
      {activeBody.split("\n\n").map((para, i) => (
        <div key={i} className="whitespace-pre-line">{para}</div>
      ))}
      <div className="pt-4">Yours sincerely,</div>
      <SignatureBlock name={issuer.name} certifiers={certifiers} showSignature={showSignature} />
      <div>{issuer.name}</div>
      <div className="text-xs text-slate-500">Registered Certifier / {issuer.registrationNo}</div>
      <div className="text-xs text-slate-500">{FIRM.name} Pty Ltd</div>
    </div>
  );
}

function ApplicantLetterBody({ project, record, certRef, certifiers, showSignature }) {
  const d = project.details;
  const pathway = project.pathway;
  const pathwayFull = pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate";
  const issuer = record.issuedBy || { name: FIRM.certifierName, registrationNo: FIRM.certifierRego, registrationBody: FIRM.certifierBody };
  const applicantName = [d.contact.title, d.contact.givenNames, d.contact.surname].filter(Boolean).join(" ") || d.contact.nameOrCompany || "Applicant";

  const defaultBody = [
    `Enclosed is a copy of the approved ${pathwayFull} for the subject development, and a copy of the stamped plans.`,
    `One copy of each has been forwarded directly to ${d.council.lga || "Council"} for their records.`,
    `The Applicant / Owner is required to lodge the Appointment of a Principal Certifier to us through the NSW Planning Portal.`,
    `Please note that no works can commence on site less than 7 days from the date of issuance of ${pathway}.`,
    `Once our office accepts the Principal Certifier Appointment through the NSW Planning Portal the Applicant / Owner is required to lodge the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site.`,
    `The Principal Certifier role to be undertaken by ${issuer.name} will require inspections and certification.`,
    `Please have the Owner/Builder or licensed contractor liaise with ${issuer.name} prior to commencement of the work.`,
    `Please note that to accept the Notice of Appointment of Principal Certifier and Commencement of Building Work, you must provide:\n1. Receipt of the Council Contribution Fee.\n2. Receipt of the Council Work Permit Fee.\n3. Builder's Home Building Compensation Fund (HBCF Certificate) or Owner Builder Permit.\n4. Erosion and Sediment Controls to be implemented on site.\n5. Lodge the Principal Certifier Appointment to us through the NSW Planning Portal.`,
    `Should you need to discuss any issues, please do not hesitate to contact the undersigned on the above numbers.`,
  ].join("\n\n");
  const activeBody = project.applicantLetterOverride || defaultBody;

  return (
    <div className="text-sm space-y-4">
      <div className="flex justify-between">
        <div>Our reference: {certRef.split("/")[0]}</div>
        <div>{record.generatedDate}</div>
      </div>
      <div>
        {applicantName}<br />
        {formatAddress(d.applicantAddress)}
      </div>
      <div>Dear Sir/Madam,</div>
      <div>
        <div><strong>Re:</strong> {project.address}</div>
        <div className="mt-2"><strong>{pathwayFull} No.:</strong>&nbsp;&nbsp;{certRef}</div>
      </div>
      {activeBody.split("\n\n").map((para, i) => (
        <div key={i} className={`whitespace-pre-line ${para.startsWith("Please note that to accept") ? "bg-amber-50 border border-amber-200 rounded-md px-4 py-3" : ""}`}>
          {para}
        </div>
      ))}
      <div className="pt-4">Yours sincerely,</div>
      <SignatureBlock name={issuer.name} certifiers={certifiers} showSignature={showSignature} />
      <div>{issuer.name}</div>
      <div className="text-xs text-slate-500">Registered Certifier / {issuer.registrationNo}</div>
      <div className="text-xs text-slate-500">{FIRM.name} Pty Ltd</div>
    </div>
  );
}

function InspectionsNoticeBody({ project, record, certRef, certifiers, showSignature }) {
  const d = project.details;
  const pathway = project.pathway;
  const issuer = record.issuedBy || { name: FIRM.certifierName, registrationNo: FIRM.certifierRego, registrationBody: FIRM.certifierBody };
  const applicantName = [d.contact.title, d.contact.givenNames, d.contact.surname].filter(Boolean).join(" ") || d.contact.nameOrCompany || "Applicant";
  const selected = MANDATORY_CRITICAL_STAGE_INSPECTIONS.filter((r) => (project.criticalStageInspections || []).includes(r.no));

  return (
    <div className="text-sm space-y-3">
      <div className="text-base font-bold">NOTICE TO APPLICANT OF MANDATORY CRITICAL STAGE INSPECTIONS</div>
      <div className="text-xs text-slate-500">Made under Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 — Section 58</div>

      <div className="font-bold border-b border-slate-300 pb-1 mt-4">APPLICANT DETAILS</div>
      <table className="w-full"><tbody>
        <CertRow label="Name of the person having benefit of the Development Consent:" value={applicantName} />
        <CertRow label="Address:" value={formatAddress(d.applicantAddress)} />
        <CertRow label="Phone:" value={d.contact.phone || d.contact.mobile} />
      </tbody></table>

      <div className="font-bold border-b border-slate-300 pb-1 mt-4">COMPLYING DEVELOPMENT CONSENTS</div>
      <table className="w-full"><tbody>
        <CertRow label="Consent Authority / Local Government Area:" value={d.council.lga} />
        <CertRow label="Decision Made Under:" value={d.certificateDetails.relevantInstrument} />
        <CertRow label={`${pathway} Number:`} value={certRef} />
      </tbody></table>

      <div className="font-bold border-b border-slate-300 pb-1 mt-4">PROPOSAL</div>
      <table className="w-full"><tbody>
        <CertRow label="Address of Development:" value={project.address} />
        <CertRow label="Scope of Building Works Covered by this Notice:" value={project.description} />
      </tbody></table>

      <div className="font-bold border-b border-slate-300 pb-1 mt-4">CERTIFICATION DETAILS</div>
      <table className="w-full"><tbody>
        <CertRow label="Certifying Authority:" value={issuer.name} />
        <CertRow label="Registration Number:" value={issuer.registrationNo} />
      </tbody></table>

      <div className="pt-2">
        I, {issuer.name}, of {FIRM.name} Pty Ltd located at {FIRM.office}, acting as the principal certifier, hereby give notice in accordance with Section 58 of Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to the person having the benefit of the development consent that the mandatory critical stage inspections identified in Schedule 1 are to be carried out in respect of the building work.
      </div>
      <div>
        The applicant, being the person having benefit of the development consent, is required under Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to notify the principal contractor (if not an owner-builder) of the applicable mandatory critical stage inspections specified under this notice.
      </div>
      <div>
        To allow a principal certifier or another certifying authority time to carry out mandatory critical stage inspections, the principal contractor for the building site, or the owner builder, must notify the principal certifier at least 48 hours before building work is commenced at the site if a mandatory critical stage inspection is required before the commencement of the work in accordance with Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021.
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
        Failure to request a mandatory critical stage inspection will prohibit the principal certifier under Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to issue an occupation certificate.
      </div>

      <div className="flex justify-between pt-4">
        <span />
        <span>Dated: {record.generatedDate}</span>
      </div>
      <div className="pt-8 border-b border-slate-400 w-56" />
      <div>{issuer.name}</div>
      <div className="text-xs text-slate-500">Principal Certifier / {issuer.registrationNo}</div>

      <div className="font-bold mt-6 mb-1">SCHEDULE 1: MANDATORY CRITICAL STAGE INSPECTIONS</div>
      <div className="overflow-x-auto">
      <table className="w-full border border-slate-300 text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-3 py-1.5 w-10 text-left">No.</th>
            <th className="border border-slate-300 px-3 py-1.5 text-left">Critical Stage Inspection</th>
            <th className="border border-slate-300 px-3 py-1.5 w-56 text-left">Inspector</th>
          </tr>
        </thead>
        <tbody>
          {selected.map((r) => (
            <tr key={r.no}>
              <td className="border border-slate-300 px-3 py-1.5">{r.no}.</td>
              <td className="border border-slate-300 px-3 py-1.5">{r.stage}</td>
              <td className="border border-slate-300 px-3 py-1.5">{r.inspector}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Checklist summary — a plain audit-trail listing of every document
// requested on the CDC/CC checklist (whatever its status), for the final
// section of the combined certificate package.
function ChecklistSummaryBody({ project }) {
  const items = project.checklists[project.pathway] || [];
  return (
    <div className="text-sm">
      <div className="text-base font-bold mb-1">DOCUMENTS REQUESTED — {project.pathway} CHECKLIST</div>
      <div className="text-xs text-slate-500 mb-3">Every document requested from the applicant during assessment, for reference.</div>
      <div className="overflow-x-auto">
      <table className="w-full border border-slate-300 text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-3 py-1.5 text-left">Document</th>
            <th className="border border-slate-300 px-3 py-1.5 w-32 text-left">Status</th>
            <th className="border border-slate-300 px-3 py-1.5 w-28 text-left">Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td className="border border-slate-300 px-3 py-1.5">{i.title}</td>
              <td className="border border-slate-300 px-3 py-1.5 capitalize">{i.status}</td>
              <td className="border border-slate-300 px-3 py-1.5">{i.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function CouncilLetterModal({ project, record, certRef, certifiers, onSaveOverride, onClose }) {
  const d = project.details;
  const pathway = project.pathway;
  const pathwayFull = pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate";
  const issuer = record.issuedBy || { name: FIRM.certifierName, registrationNo: FIRM.certifierRego, registrationBody: FIRM.certifierBody };
  const projRef = `${pathway}-${d.projectNumber || project.id.toUpperCase()}`;

  const defaultBody = [
    `${FIRM.name} Pty Ltd has issued a ${pathwayFull} under Part 4 of the Environmental Planning and Assessment Act 1979 for the above premises.`,
    `Please find enclosed the following documentation:\n- ${pathwayFull} No. ${certRef}\n- Copy of the application for the ${pathwayFull}.\n- Documentation used to determine the application for the ${pathwayFull} as detailed in Schedule 1 of the Certificate.`,
    ...(pathway === "CDC" ? ["The applicant / owner has been advised to submit the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site."] : []),
    `Should you need to discuss any issues, please do not hesitate to contact the Registered Building Surveyor ${issuer.name}.`,
  ].join("\n\n");

  const [editing, setEditing] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const activeBody = project.councilLetterOverride || defaultBody;
  const [draft, setDraft] = useState(activeBody);

  const startEdit = () => {
    setDraft(activeBody);
    setEditing(true);
  };
  const save = () => {
    onSaveOverride(draft);
    setEditing(false);
  };
  const resetToAuto = () => {
    onSaveOverride("");
    setDraft(defaultBody);
    setEditing(false);
  };

  return (
    <LetterShell title="Council notification letter" filename={`${projRef}-Council-Letter.doc`} onClose={onClose}>
      <div className="text-sm space-y-4">
        <div className="flex justify-between">
          <div>Our reference: {projRef}</div>
          <div>{record.generatedDate}</div>
        </div>
        <div>
          The General Manager<br />
          {d.council.lga || "Council"}<br />
          {formatAddress(d.council.address)}
        </div>
        <div>Dear Sir/Madam,</div>
        <div>
          <div><strong>Re:</strong> {project.address}</div>
          <div className="mt-2"><strong>{pathwayFull} No.</strong>&nbsp;&nbsp;{certRef}</div>
          <div className="mt-1"><strong>Planning Instrument Decision Made Under:</strong>&nbsp;&nbsp;{d.certificateDetails.relevantInstrument || "—"}</div>
        </div>

        <div className="print:hidden flex items-center gap-2 pb-1">
          {!editing && (
            <button onClick={startEdit} className="flex items-center gap-1 text-xs text-teal-700 font-medium hover:underline">
              <Pencil size={12} /> Edit letter
            </button>
          )}
          {!editing && project.councilLetterOverride && (
            <button onClick={resetToAuto} className="text-xs text-slate-400 hover:underline">Reset to auto-generated</button>
          )}
          {!editing && (
            <button onClick={() => setShowSignature((v) => !v)} className={`text-xs font-medium hover:underline ${showSignature ? "text-emerald-700" : "text-teal-700"}`}>
              {showSignature ? "✓ Signed — back to draft" : "Generate with signature"}
            </button>
          )}
        </div>

        {editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <div className="flex gap-2 mt-2 print:hidden">
              <button onClick={save} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900">Save</button>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-slate-500 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        ) : (
          activeBody.split("\n\n").map((para, i) => (
            <div key={i} className="whitespace-pre-line">{para}</div>
          ))
        )}

        <div className="pt-4">Yours sincerely,</div>
        <SignatureBlock name={issuer.name} certifiers={certifiers} showSignature={showSignature} />
        <div>{issuer.name}</div>
        <div className="text-xs text-slate-500">Registered Certifier / {issuer.registrationNo}</div>
        <div className="text-xs text-slate-500">{FIRM.name} Pty Ltd</div>
      </div>
    </LetterShell>
  );
}

// Applicant notification letter — the companion letter sent to the
// applicant/owner at the same time as the council letter above.
function ApplicantLetterModal({ project, record, certRef, certifiers, onSaveOverride, onClose }) {
  const d = project.details;
  const pathway = project.pathway;
  const pathwayFull = pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate";
  const issuer = record.issuedBy || { name: FIRM.certifierName, registrationNo: FIRM.certifierRego, registrationBody: FIRM.certifierBody };
  const projRef = `${pathway}-${d.projectNumber || project.id.toUpperCase()}`;
  const applicantName = [d.contact.title, d.contact.givenNames, d.contact.surname].filter(Boolean).join(" ") || d.contact.nameOrCompany || "Applicant";

  const defaultBody = [
    `Enclosed is a copy of the approved ${pathwayFull} for the subject development, and a copy of the stamped plans.`,
    `One copy of each has been forwarded directly to ${d.council.lga || "Council"} for their records.`,
    `The Applicant / Owner is required to lodge the Appointment of a Principal Certifier to us through the NSW Planning Portal.`,
    `Please note that no works can commence on site less than 7 days from the date of issuance of ${pathway}.`,
    `Once our office accepts the Principal Certifier Appointment through the NSW Planning Portal the Applicant / Owner is required to lodge the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site.`,
    `The Principal Certifier role to be undertaken by ${issuer.name} will require inspections and certification.`,
    `Please have the Owner/Builder or licensed contractor liaise with ${issuer.name} prior to commencement of the work.`,
    `Please note that to accept the Notice of Appointment of Principal Certifier and Commencement of Building Work, you must provide:\n1. Receipt of the Council Contribution Fee.\n2. Receipt of the Council Work Permit Fee.\n3. Builder's Home Building Compensation Fund (HBCF Certificate) or Owner Builder Permit.\n4. Erosion and Sediment Controls to be implemented on site.\n5. Lodge the Principal Certifier Appointment to us through the NSW Planning Portal.`,
    `Should you need to discuss any issues, please do not hesitate to contact the undersigned on the above numbers.`,
  ].join("\n\n");

  const [editing, setEditing] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const activeBody = project.applicantLetterOverride || defaultBody;
  const [draft, setDraft] = useState(activeBody);

  const startEdit = () => {
    setDraft(activeBody);
    setEditing(true);
  };
  const save = () => {
    onSaveOverride(draft);
    setEditing(false);
  };
  const resetToAuto = () => {
    onSaveOverride("");
    setDraft(defaultBody);
    setEditing(false);
  };

  return (
    <LetterShell title="Applicant notification letter" filename={`${projRef}-Applicant-Letter.doc`} onClose={onClose}>
      <div className="text-sm space-y-4">
        <div className="flex justify-between">
          <div>Our reference: {projRef}</div>
          <div>{record.generatedDate}</div>
        </div>
        <div>
          {applicantName}<br />
          {formatAddress(d.applicantAddress)}
        </div>
        <div>Dear Sir/Madam,</div>
        <div>
          <div><strong>Re:</strong> {project.address}</div>
          <div className="mt-2"><strong>{pathwayFull} No.:</strong>&nbsp;&nbsp;{certRef}</div>
        </div>

        <div className="print:hidden flex items-center gap-2 pb-1">
          {!editing && (
            <button onClick={startEdit} className="flex items-center gap-1 text-xs text-teal-700 font-medium hover:underline">
              <Pencil size={12} /> Edit letter
            </button>
          )}
          {!editing && project.applicantLetterOverride && (
            <button onClick={resetToAuto} className="text-xs text-slate-400 hover:underline">Reset to auto-generated</button>
          )}
          {!editing && (
            <button onClick={() => setShowSignature((v) => !v)} className={`text-xs font-medium hover:underline ${showSignature ? "text-emerald-700" : "text-teal-700"}`}>
              {showSignature ? "✓ Signed — back to draft" : "Generate with signature"}
            </button>
          )}
        </div>

        {editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={16}
              className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <div className="flex gap-2 mt-2 print:hidden">
              <button onClick={save} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900">Save</button>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-slate-500 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        ) : (
          activeBody.split("\n\n").map((para, i) => (
            <div key={i} className={`whitespace-pre-line ${para.startsWith("Please note that to accept") ? "bg-amber-50 border border-amber-200 rounded-md px-4 py-3" : ""}`}>
              {para}
            </div>
          ))
        )}

        <div className="pt-4">Yours sincerely,</div>
        <SignatureBlock name={issuer.name} certifiers={certifiers} showSignature={showSignature} />
        <div>{issuer.name}</div>
        <div className="text-xs text-slate-500">Registered Certifier / {issuer.registrationNo}</div>
        <div className="text-xs text-slate-500">{FIRM.name} Pty Ltd</div>
      </div>
    </LetterShell>
  );
}

// Statutory notice to the applicant listing every mandatory critical stage
// inspection — issued under s58 of the Development Certification and Fire
// Safety Regulation 2021, alongside the CDC/CC.
function InspectionsNoticeModal({ project, record, certRef, certifiers, onClose }) {
  const projRef = `${project.pathway}-${project.details.projectNumber || project.id.toUpperCase()}`;
  const [showSignature, setShowSignature] = useState(false);
  return (
    <LetterShell title="Notice of mandatory critical stage inspections" filename={`${projRef}-Inspections-Notice.doc`} onClose={onClose}>
      <div className="print:hidden mb-2">
        <button onClick={() => setShowSignature((v) => !v)} className={`text-xs font-medium hover:underline ${showSignature ? "text-emerald-700" : "text-teal-700"}`}>
          {showSignature ? "✓ Signed — back to draft" : "Generate with signature"}
        </button>
      </div>
      <InspectionsNoticeBody project={project} record={record} certRef={certRef} certifiers={certifiers} showSignature={showSignature} />
    </LetterShell>
  );
}

function CertificateBody({ project, variant, record, certRef, certifiers, showSignature }) {
  const d = project.details;
  const isOC = variant === "oc";
  const isMod = variant === "pathway_mod";
  const pathway = project.pathway;
  const issuer = record.issuedBy || { name: FIRM.certifierName, registrationNo: FIRM.certifierRego, registrationBody: FIRM.certifierBody };

  const baseTitle = pathway === "CDC" ? "COMPLYING DEVELOPMENT CERTIFICATE" : "CONSTRUCTION CERTIFICATE";
  const title = isOC ? `OCCUPATION CERTIFICATE (${record.type === "whole" ? "WHOLE" : "PARTIAL"})` : isMod ? `MODIFIED ${baseTitle}` : baseTitle;
  // Use the same certRef everywhere on this document — title, "PROJECT
  // REFERENCE" line, and footer must never show different numbers for the
  // same certificate.
  const projectRef = certRef;

  const applicantName = [d.contact.title, d.contact.givenNames, d.contact.surname].filter(Boolean).join(" ") || d.contact.nameOrCompany || "—";
  const applicantAddr = formatAddress(d.applicantAddress);
  const ownerName = d.ownerSameAsApplicant ? applicantName : d.owner.name || "—";
  const ownerAddr = d.ownerSameAsApplicant ? applicantAddr : formatAddress(d.owner.address);
  const ownerPhone = d.ownerSameAsApplicant ? d.contact.phone || d.contact.mobile : d.owner.phone;

  // Attachments: every approved document. OC pulls from every stage; a
  // modification pulls from its own checklist; the original CDC/CC pulls
  // from just that stage.
  const attachments = isOC
    ? [...project.checklists[pathway], ...project.checklists.NOC, ...project.checklists.OC].filter((i) => i.status === "approved")
    : isMod
    ? (project.checklists[record.id] || []).filter((i) => i.status === "approved")
    : project.checklists[pathway].filter((i) => i.status === "approved");

  const inspectionsList = project.inspections.filter((i) => i.outcome === "passed" || i.outcome === "failed");

  return (
    <div className="relative">
          <div
            data-stamp="true"
            className="absolute top-24 right-10 border-4 border-teal-700 text-teal-700 rounded-lg px-4 py-2 text-center opacity-80 pointer-events-none select-none"
            style={{ transform: "rotate(-8deg)" }}
          >
            <div className="text-lg font-black tracking-widest leading-none">APPROVED</div>
            <div className="text-[10px] font-semibold mt-1">{issuer.name}</div>
            <div className="text-[10px]">{record.generatedDate}</div>
          </div>
          {/* Letterhead */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
            <div>
              <div className="text-lg font-black tracking-tight">{FIRM.name}</div>
              <div className="text-[11px] text-slate-500">PTY LTD</div>
              <div className="text-xs text-slate-500 mt-1">ABN: {FIRM.abn}</div>
            </div>
            <div className="text-right text-xs text-slate-600 leading-relaxed">
              <div>Postal: {FIRM.postal}</div>
              <div>Office: {FIRM.office}</div>
              <div>(p): {FIRM.phone}</div>
              <div>(e): {FIRM.email}</div>
            </div>
          </div>

          <h1 className="text-lg font-bold">{title} {certRef}</h1>
          <div className="text-sm font-semibold">PROJECT REFERENCE {projectRef}</div>
          <div className="text-xs text-slate-500 mt-1 mb-6">
            {isOC
              ? "Issued under Part 6 of the Environmental Planning and Assessment Act 1979"
              : "Issued under Part 4, Division 4.5 of the Environmental Planning and Assessment Act 1979"}
          </div>

          {isMod && (
            <>
              <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">REASON FOR MODIFICATION</div>
              <div className="text-sm text-slate-700 mb-4">{record.reason || "—"}</div>
            </>
          )}

          {isOC && record.type === "partial" && (
            <>
              <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">SCOPE OF PARTIAL OCCUPATION</div>
              <div className="text-sm text-slate-700 mb-4">{record.description || "—"}</div>
            </>
          )}

          <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">APPLICANT DETAILS</div>
          <table className="w-full mb-4"><tbody>
            <CertRow label="Applicant:" value={applicantName} />
            <CertRow label="Address:" value={applicantAddr} />
            <CertRow label="Phone:" value={d.contact.phone || d.contact.mobile} />
          </tbody></table>

          <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">OWNER DETAILS</div>
          <table className="w-full mb-4"><tbody>
            <CertRow label="Owner" value={ownerName} />
            <CertRow label="Address:" value={ownerAddr} />
            <CertRow label="Phone:" value={ownerPhone} />
          </tbody></table>

          <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">
            {isOC ? "OCCUPATION CERTIFICATE DETAILS" : `${pathway === "CDC" ? "COMPLYING DEVELOPMENT" : "CONSTRUCTION"} CERTIFICATE DETAILS`}
          </div>
          <table className="w-full mb-4"><tbody>
            {!isOC && <CertRow label="NSW Planning Portal Ref Number:" value={d.certificateDetails.planningPortalRef} />}
            <CertRow label="Local Government Area:" value={d.council.lga} />
            {!isOC && <CertRow label="Relevant Environmental Planning Instrument" value={d.certificateDetails.relevantInstrument} />}
            {!isOC && <CertRow label="Relevant Part of Code" value={d.certificateDetails.relevantPartOfCode} />}
            <CertRow label="Date of Determination:" value={d.certificateDetails.determinationDate} />
            {!isOC && pathway === "CDC" && <CertRow label="Date of Lapse:" value={effectiveLapseDate(project)} />}
          </tbody></table>

          <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">PROPOSAL</div>
          <table className="w-full mb-4"><tbody>
            <CertRow label="Address of Development:" value={project.address} />
            <CertRow label="Lot/Section/DP:" value={d.certificateDetails.lotSectionDp} />
            <CertRow label="Land Use Zone:" value={d.zoning} />
            <CertRow label="BCA Classification/s:" value={d.proposal.classifications.join(", ")} />
            <CertRow label="BCA/NCC Version:" value={d.bcaVersion} />
            <CertRow label="Description of Building Works:" value={project.description} />
            <CertRow label="Value of Construction (incl. GST):" value={d.proposal.estimatedCost ? `$${Number(d.proposal.estimatedCost).toLocaleString()}` : ""} />
            {!isOC && <CertRow label="Attachments" value="Schedule 1: Approved Plans and Specifications and Supporting Documentation Relied Upon" />}
          </tbody></table>

          {!isOC && (
            <>
              <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">CONDITIONS</div>
              <div className="text-sm text-slate-700 mb-2">
                Conditions under the Environmental Planning and Assessment Regulation 2021 and State Environmental Planning Policy (Exempt and Complying Development) Codes 2008:
              </div>
              <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1 mb-2">
                <li>
                  Any monetary contribution fees and/or any other Council fees/bonds that are required by Council MUST be paid prior to commencement of building works. A receipt is to be sent to the PC. Any works on council property MUST have prior approval from Council and a copy of such approval provided to the PC prior to the works commencing.
                </li>
                {project.conditions.map((c) => (
                  <li key={c.id}>{c.text}</li>
                ))}
              </ol>

              <div className="text-sm font-bold mt-4 mb-1">Critical stage inspections:</div>
              <div className="text-sm text-slate-700 mb-4">See attached Notice</div>
            </>
          )}

          <div className="text-sm font-bold mb-2">
            {isOC ? "SCHEDULE: DOCUMENTS RELIED UPON FOR ISSUE OF THIS CERTIFICATE" : "SCHEDULE 1: APPROVED PLANS AND SPECIFICATIONS/ SUPPORTING DOCUMENTATION RELIED UPON"}
          </div>
          {attachments.length === 0 ? (
            <div className="text-sm text-slate-400 italic mb-4">No approved documents recorded for this stage yet.</div>
          ) : (
            <>
              {[
                { key: "Architectural", label: "1. Endorsed Architectural Plans", withRevision: true },
                { key: "Structural", label: "2. Structural Plans", withRevision: true },
                { key: "Engineering", label: "3. Engineering Plans", withRevision: true },
                { key: "Other", label: "4. Other Documentation Relied Upon", withRevision: false },
              ].map((section) => {
                const items = attachments.filter((a) => (a.category || "Other") === section.key);
                if (items.length === 0) return null;
                return (
                  <div key={section.key} className="mb-4">
                    <div className="text-sm font-semibold mb-1">{section.label}</div>
                    <div className="overflow-x-auto">
                    <table className="w-full border border-slate-300 text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="text-left font-semibold px-3 py-1.5 border border-slate-300 w-40">Prepared by</th>
                          <th className="text-left font-semibold px-3 py-1.5 border border-slate-300">Document</th>
                          <th className="text-left font-semibold px-3 py-1.5 border border-slate-300 w-28">Drawing number</th>
                          {section.withRevision && <th className="text-left font-semibold px-3 py-1.5 border border-slate-300 w-20">Revision</th>}
                          <th className="text-left font-semibold px-3 py-1.5 border border-slate-300 w-28">Date</th>
                          <th className="text-left font-semibold px-3 py-1.5 border border-slate-300 w-20">Stamped</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((a) => (
                          <tr key={a.id}>
                            <td className="px-3 py-1.5 border border-slate-300">{a.preparedBy || "—"}</td>
                            <td className="px-3 py-1.5 border border-slate-300">{a.title}</td>
                            <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{a.drawingNumber || "—"}</td>
                            {section.withRevision && <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{a.revision || "—"}</td>}
                            <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{a.documentDate || a.date}</td>
                            <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{a.requiresStamping ? "✓" : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {isOC && (
            <>
              <div className="text-sm font-bold mb-1">Critical Stage Inspections Completed</div>
              {inspectionsList.length === 0 ? (
                <div className="text-sm text-slate-400 italic mb-4">No inspections recorded as complete.</div>
              ) : (
                <table className="w-full mb-4 border border-slate-300 text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-left font-semibold px-3 py-1.5 border border-slate-300">Inspection</th>
                      <th className="text-left font-semibold px-3 py-1.5 border border-slate-300 w-32">Date</th>
                      <th className="text-left font-semibold px-3 py-1.5 border border-slate-300 w-40">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectionsList.map((i) => {
                      const openDefects = (i.defects || []).filter((x) => !x.resolved).length;
                      return (
                        <tr key={i.id}>
                          <td className="px-3 py-1.5 border border-slate-300">{i.title}</td>
                          <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{formatISODate(i.date)}</td>
                          <td className="px-3 py-1.5 border border-slate-300 text-slate-600">{i.outcome === "passed" ? "Passed" : `Failed (${openDefects} open defect${openDefects === 1 ? "" : "s"})`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}

          <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2 mt-6">REGISTERED CERTIFIER</div>
          <table className="w-full mb-2"><tbody>
            <CertRow label="Registered Certifier:" value={issuer.name} />
            <CertRow label="Registration No:" value={issuer.registrationNo} />
            <CertRow label="Registration Body:" value={issuer.registrationBody} />
          </tbody></table>

          <div className="mt-8 text-sm text-slate-800 italic leading-relaxed">
            I, {issuer.name}, as the certifying authority certify that{" "}
            {isOC
              ? "the building is suitable for occupation or use in accordance with its classification under the Building Code of Australia, and that all conditions relevant to the issue of this Occupation Certificate have been satisfied."
              : pathway === "CDC"
              ? "the development is complying development and (if carried out as specified in the certificate) will comply with all development standards applicable to the development and with such other requirements prescribed by this regulation concerning the issue of the certificate."
              : "the plans, specifications and other documents relied upon for the issue of this Construction Certificate are consistent with the development consent and comply with the requirements of the Building Code of Australia applicable to the development."}
          </div>

          <div className="flex justify-between items-end mt-6 mb-1">
            <span className="text-sm font-bold not-italic">Dated:</span>
            <span className="text-sm">{record.generatedDate}</span>
          </div>

          <SignatureBlock name={issuer.name} certifiers={certifiers} showSignature={showSignature} />
          <div className="text-sm text-slate-800">{issuer.name}</div>

          {!isOC && pathway === "CDC" && (
            <div className="text-xs text-slate-600 mt-4">
              <span className="font-bold">N.B.</span> Prior to the commencement of work section 6.6 of the Environmental Planning and Assessment Act 1979 must be satisfied.
            </div>
          )}

          <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-200 mt-8 pt-2">
            <span>Project No.: {projectRef}</span>
            <span>Page 1</span>
            <span>{FIRM.website}</span>
          </div>
    </div>
  );
}

function CertificateModal({ project, variant, record, certRef, certifiers, onClose }) {
  const contentRef = useRef(null);
  const [showSignature, setShowSignature] = useState(false);
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-3 flex justify-between items-center print:hidden">
          <span className="text-sm font-semibold text-slate-600">Certificate preview</span>
          <div className="flex gap-2 items-center">
            <button onClick={() => setShowSignature((v) => !v)} className={`text-xs font-medium hover:underline mr-1 ${showSignature ? "text-emerald-700" : "text-teal-700"}`}>
              {showSignature ? "✓ Signed — back to draft" : "Generate with signature"}
            </button>
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
              Print / Save as PDF
            </button>
            <button
              onClick={() => {
                const clone = contentRef.current.cloneNode(true);
                const stamp = clone.querySelector("[data-stamp]");
                if (stamp) stamp.remove();
                downloadAsWordDoc(`${certRef}.doc`, clone.innerHTML);
              }}
              className="px-3 py-1.5 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50"
            >
              Export as Word
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><X size={18} /></button>
          </div>
        </div>

        <div className="p-8 text-slate-900" ref={contentRef}>
          <CertificateBody project={project} variant={variant} record={record} certRef={certRef} certifiers={certifiers} showSignature={showSignature} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspection report document
// ---------------------------------------------------------------------------

function InspectionReportModal({ project, inspection, onSend, onReportPortal, certifiers, onClose }) {
  const contentRef = useRef(null);
  const d = project.details;
  const applicantName = [d.contact.title, d.contact.givenNames, d.contact.surname].filter(Boolean).join(" ") || d.contact.nameOrCompany || "—";
  const applicantAddr = formatAddress(d.applicantAddress);
  const defects = inspection.defects || [];
  const resultLabel =
    inspection.outcome === "passed" ? "PASSED" : inspection.outcome === "failed" ? "FAILED" : inspection.outcome === "passed_subject_to" ? "PASSED SUBJECT TO CONDITIONS" : "PENDING";
  const outcomeText =
    inspection.outcome === "passed"
      ? "Satisfactory — no issues identified"
      : inspection.outcome === "passed_subject_to"
      ? "Satisfactory (minor issues) subject to documents/conditions being provided"
      : inspection.outcome === "failed"
      ? "Unsatisfactory — see required documents below"
      : "Pending";
  const reinspectionText =
    inspection.outcome === "failed" ? "Re-inspection required" : inspection.outcome === "passed_subject_to" ? "No re-inspection required, subject to documents/conditions being provided" : "No re-inspections required for this inspection.";
  const certRef = pathwayIssued(project) ? pathwayCertRef(project) : d.projectNumber || project.id.toUpperCase();
  const [showSignature, setShowSignature] = useState(false);

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-3 flex justify-between items-center print:hidden">
          <span className="text-sm font-semibold text-slate-600">Inspection report preview</span>
          <div className="flex gap-2 items-center">
            <button onClick={() => setShowSignature((v) => !v)} className={`text-xs font-medium hover:underline mr-1 ${showSignature ? "text-emerald-700" : "text-teal-700"}`}>
              {showSignature ? "✓ Signed — back to draft" : "Generate with signature"}
            </button>
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">Print / Save as PDF</button>
            <button
              onClick={() => {
                const clone = contentRef.current.cloneNode(true);
                const photoSection = clone.querySelector('[data-photo-evidence]');
                if (photoSection) {
                  const note = document.createElement("p");
                  note.style.fontStyle = "italic";
                  note.style.color = "#888";
                  note.textContent = "Photographic evidence is not included in this Word export — view or print the report directly to include photos.";
                  photoSection.replaceWith(note);
                }
                downloadAsWordDoc(`Inspection-Report-${inspection.title.replace(/\s+/g, "-")}.doc`, clone.innerHTML);
              }}
              className="px-3 py-1.5 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50"
            >
              Export as Word
            </button>
            <button onClick={onSend} disabled={inspection.reportSent} className="px-3 py-1.5 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50 disabled:opacity-50 disabled:cursor-default">
              {inspection.reportSent ? `Sent ${inspection.reportSentDate}` : "Send to client"}
            </button>
            <button onClick={onReportPortal} disabled={inspection.portalReported} className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-default">
              {inspection.portalReported ? `Reported ${inspection.portalReportedDate}` : "Report to NSW Planning Portal"}
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><X size={18} /></button>
          </div>
        </div>
        <div className="px-6 py-1.5 text-[11px] text-slate-400 print:hidden">
          "Report to NSW Planning Portal" is simulated here — the real build submits via the Portal's Common API (CSIPerformed/CSIMissed) automatically, per the legal 2-business-day requirement.
        </div>

        <div className="p-8 text-slate-900" ref={contentRef}>
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
            <div>
              <div className="text-lg font-black tracking-tight">{FIRM.name}</div>
              <div className="text-[11px] text-slate-500">PTY LTD</div>
              <div className="text-xs text-slate-500 mt-1">ABN: {FIRM.abn}</div>
            </div>
            <div className="text-right text-xs text-slate-600 leading-relaxed">
              <div>Postal: {FIRM.postal}</div>
              <div>Office: {FIRM.office}</div>
              <div>(p): {FIRM.phone}</div>
              <div>(e): {FIRM.email}</div>
            </div>
          </div>

          <h1 className="text-lg font-bold">INSPECTION REPORT – {certRef} – {inspection.title}</h1>
          <div className="text-sm text-slate-500 mb-6">{project.address}</div>

          <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">APPLICANT DETAILS</div>
          <table className="w-full mb-4"><tbody>
            <CertRow label="Applicant:" value={applicantName} />
            <CertRow label="Address:" value={applicantAddr} />
            <CertRow label="Phone:" value={d.contact.phone || d.contact.mobile} />
          </tbody></table>

          <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">COMPLYING DEVELOPMENT CONSENTS</div>
          <table className="w-full mb-4"><tbody>
            <CertRow label="Local Government Area:" value={d.council.lga} />
            <CertRow label={`${project.pathway} Number`} value={certRef} />
          </tbody></table>

          <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">PROPOSAL</div>
          <table className="w-full mb-4"><tbody>
            <CertRow label="Address of Development:" value={project.address} />
            <CertRow label="Lot / DP:" value={d.certificateDetails.lotSectionDp} />
            <CertRow label="Land Use Zoning:" value={d.zoning} />
            <CertRow label="Scope of Building Works Covered by this Notice:" value={project.description} />
          </tbody></table>

          <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">INSPECTION DETAILS</div>
          <table className="w-full mb-4"><tbody>
            <CertRow label="Inspector:" value={inspection.inspectorName} />
            <CertRow label="Inspection date:" value={formatISODate(inspection.date)} />
            <CertRow label="Registration No.:" value={inspection.inspectorLicense} />
          </tbody></table>

          <div className="text-sm font-bold mb-1">INSPECTION RESULTS</div>
          <div className="text-xs text-slate-500 mb-2">We have attended the above property and completed an inspection. The area inspected and the overall outcome of the inspection are listed below, together with any specific defects noted or documents required.</div>
          <table className="w-full mb-4 border border-slate-300 text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left font-semibold px-3 py-1.5 border border-slate-300">Inspection Area</th>
                <th className="text-left font-semibold px-3 py-1.5 border border-slate-300">Inspection Outcome</th>
                <th className="text-left font-semibold px-3 py-1.5 border border-slate-300 w-40">Reinspections</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-1.5 border border-slate-300">1. {inspection.title}</td>
                <td className="px-3 py-1.5 border border-slate-300">{outcomeText}</td>
                <td className="px-3 py-1.5 border border-slate-300">{reinspectionText}</td>
              </tr>
            </tbody>
          </table>

          <div className="text-sm font-bold mb-1">REQUIRED DOCUMENTS</div>
          {defects.length === 0 ? (
            <div className="text-sm text-slate-400 italic mb-4">None.</div>
          ) : (
            <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-0.5 mb-4">
              {defects.map((d2) => (
                <li key={d2.id}>
                  {d2.text} — {d2.resolved ? <span className="text-emerald-600 font-medium">Resolved</span> : <span className="text-amber-700 font-medium">Required</span>}
                </li>
              ))}
            </ol>
          )}

          <div className="text-sm font-bold border-b border-slate-300 pb-1 mb-2 mt-6">SIGNED BY:</div>
          <SignatureBlock name={inspection.inspectorName} certifiers={certifiers} showSignature={showSignature} />
          <div className="text-sm">{inspection.inspectorName} – Inspector</div>
          <div className="text-sm text-slate-500">{formatISODate(inspection.date)}</div>

          <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-200 mt-8 pt-2">
            <span>Project No.: {certRef}</span>
            <span>{FIRM.website}</span>
          </div>

          {(inspection.photos || []).length > 0 && (
            <div data-photo-evidence="true" style={{ pageBreakBefore: "always", breakBefore: "page" }} className="pt-8">
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                <div>
                  <div className="text-lg font-black tracking-tight">{FIRM.name}</div>
                  <div className="text-[11px] text-slate-500">PTY LTD</div>
                  <div className="text-xs text-slate-500 mt-1">ABN: {FIRM.abn}</div>
                </div>
                <div className="text-right text-xs text-slate-600 leading-relaxed">
                  <div>Postal: {FIRM.postal}</div>
                  <div>Office: {FIRM.office}</div>
                  <div>(p): {FIRM.phone}</div>
                  <div>(e): {FIRM.email}</div>
                </div>
              </div>
              <h2 className="text-lg font-bold mb-1">PHOTOGRAPHIC EVIDENCE</h2>
              <div className="text-sm text-slate-500 mb-4">{inspection.title} – {certRef}</div>
              <div className="grid grid-cols-2 gap-4">
                {inspection.photos.map((p, i) => (
                  <div key={p.id}>
                    <img src={p.url} alt={p.caption || p.fileName} className="w-full aspect-[4/3] object-cover rounded-md border border-slate-300" />
                    <div className="text-xs text-slate-600 mt-1">{i + 1}. {p.caption || p.fileName}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-200 mt-8 pt-2">
                <span>Project No.: {certRef}</span>
                <span>{FIRM.website}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client-facing view — a preview of what the client sees for one job.
// Read-only except for the simulated upload action. No login here — this is a
// certifier-side preview of the client experience, not a real separate client
// session (that needs real auth in the actual build).
// ---------------------------------------------------------------------------

function ClientDocRow({ item, locked, onSimulateUpload }) {
  const [justReplaced, setJustReplaced] = useState(false);
  const meta = displayStatus(item);
  const unresolved = unresolvedCount(item);
  const awaitingReview = item.status === "submitted" && unresolved > 0 && item.pendingReview;
  const actionRequired = item.status === "requested" || (item.status === "submitted" && unresolved > 0 && !item.pendingReview);
  // Client can keep replacing the file right up until it's approved — fixes
  // the common "attached the wrong file" mistake without waiting for a
  // certifier to notice and flag it first.
  const canUpload = !locked && item.status !== "approved";

  const handleClick = () => {
    onSimulateUpload();
    setJustReplaced(true);
    setTimeout(() => setJustReplaced(false), 3000);
  };

  return (
    <div className="border-t border-slate-100 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
          <div>
            <div className="font-semibold text-slate-800">{item.title}</div>
            <div className="text-sm text-slate-500 mt-0.5">{item.desc}</div>
          </div>
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
          {meta.label}
          {item.version > 1 && <span className="text-slate-300"> · v{item.version}</span>}
        </span>
      </div>

      {unresolved > 0 && !awaitingReview && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">
            <AlertTriangle size={13} /> Please address before resubmitting
          </div>
          <ul className="space-y-1.5">
            {item.amendments.filter((a) => !a.resolved).map((a) => (
              <li key={a.id} className="text-sm text-amber-900 flex gap-2">
                <span className="text-amber-500">•</span>
                {a.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.status === "submitted" && unresolved === 0 && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-md px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 uppercase tracking-wide mb-1">
            <Check size={13} /> Submitted {item.date} — awaiting your certifier's review
          </div>
          <div className="text-xs text-blue-700">Attached the wrong file? You can still replace it below until your certifier reviews it.</div>
        </div>
      )}

      {awaitingReview && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-md px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 uppercase tracking-wide mb-1">
            <Check size={13} /> Resubmitted on {item.date} — awaiting your certifier's review
          </div>
          <div className="text-xs text-blue-700">
            No action needed right now. If your certifier finds anything else to fix, it'll show up here — or you can still replace the file below if needed.
          </div>
        </div>
      )}

      {canUpload && (
        <>
          <button
            onClick={handleClick}
            className={`mt-3 flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-semibold ${
              actionRequired ? "bg-teal-700 text-white hover:bg-teal-800" : "border border-slate-200 text-teal-800 hover:bg-slate-50"
            }`}
          >
            <UploadCloud size={14} /> {item.status === "requested" ? "Upload document" : actionRequired ? "Upload revised document" : "Replace document"}
          </button>
          {justReplaced && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <Check size={13} /> File received — your certifier will be notified.
            </div>
          )}
        </>
      )}
      {locked && item.status !== "approved" && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <Lock size={12} /> Not available yet
        </div>
      )}
    </div>
  );
}

function ClientChecklistCard({ title, stageKey, items, expanded, onToggle, locked, lockedReason, onSimulateUpload }) {
  const done = items.filter((i) => i.status === "approved").length;
  const needsAttention = !locked && items.some((i) => i.status === "requested" || unresolvedCount(i) > 0);

  return (
    <div className="rounded-lg overflow-hidden mb-4 border border-amber-200">
      <button onClick={onToggle} className="w-full px-5 py-4 flex items-center justify-between transition-colors bg-slate-900 hover:bg-slate-800">
        <div className="text-left">
          <div className="font-serif font-semibold text-sm flex items-center gap-2 text-amber-300">
            {title}
            {locked && <Lock size={13} className="text-slate-400" />}
            {needsAttention && <span className="w-2 h-2 rounded-full bg-amber-400" />}
          </div>
          <div className="text-xs mt-0.5 text-slate-400">
            {locked ? lockedReason : items.length ? `${done}/${items.length} complete` : "Nothing requested yet"}
          </div>
        </div>
        <ChevronDown size={18} className={`transition-transform text-slate-400 ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded &&
        (items.length === 0 ? (
          <div className="px-5 py-6 text-sm bg-white text-slate-400">Nothing requested here yet.</div>
        ) : (
          <>
            {locked && (
              <div className="flex items-center gap-1.5 px-5 py-3 text-xs bg-amber-50 border-b border-amber-100 text-amber-800">
                <Lock size={12} /> {lockedReason}
              </div>
            )}
            {items.map((item) => (
              <ClientDocRow key={item.id} item={item} locked={locked} onSimulateUpload={() => onSimulateUpload(stageKey, item)} />
            ))}
          </>
        ))}
    </div>
  );
}

// Wraps ClientPortalView with a job-picker for a client who has more than
// one job with the firm — e.g. an architect or builder who wants to see
// everything they're working with, not just one job at a time.
function ClientMultiJobView({ client, jobs, initialJobId, onSimulateUpload, onBookInspection, onShareAccess, onRemoveSharedAccess, onExit }) {
  const [selectedJobId, setSelectedJobId] = useState(initialJobId || null);
  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  if (selectedJob) {
    return (
      <ClientPortalView
        project={selectedJob}
        onSimulateUpload={onSimulateUpload}
        onBookInspection={(inspectionId, date) => onBookInspection(selectedJob.id, inspectionId, date)}
        onExit={() => setSelectedJobId(null)}
        exitLabel="← All my jobs"
        onShareAccess={(name, email) => onShareAccess(selectedJob.id, name, email)}
        onRemoveSharedAccess={(accessId) => onRemoveSharedAccess(selectedJob.id, accessId)}
      />
    );
  }

  return (
    <div className="w-full min-h-screen font-sans bg-amber-50/30">
      <div className="px-6 py-5 flex items-center justify-between bg-slate-900 border-b border-amber-900/40">
        <div>
          <div className="font-serif text-xl tracking-tight text-amber-300">{FIRM.name}</div>
          <div className="text-[11px] tracking-[0.15em] uppercase mt-0.5 text-slate-400">Client Portal — {client?.name || "Client"}</div>
        </div>
        <button onClick={onExit} className="text-xs px-3 py-1.5 rounded-md border border-amber-800/40 text-slate-200 hover:bg-slate-800 transition-colors">
          Exit client preview
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="text-xs rounded-md px-3.5 py-2.5 mb-6 bg-amber-100 border border-amber-300 text-amber-900">
          Preview only — this is what {client?.name || "this client"} would see across every job assigned to them.
        </div>

        <h1 className="font-serif text-2xl text-slate-900 mb-1">Your jobs</h1>
        <p className="text-slate-500 mb-5">{jobs.length} job{jobs.length === 1 ? "" : "s"} with {FIRM.name}</p>

        <div className="rounded-lg overflow-hidden border border-amber-200">
          {jobs.map((job) => {
            const stagesDone = [
              stageComplete(job.checklists[job.pathway]),
              stageComplete(job.checklists.NOC),
              inspectionsComplete(job),
              hasWholeOC(job),
            ].filter(Boolean).length;
            return (
              <button key={job.id} onClick={() => setSelectedJobId(job.id)} className="w-full text-left px-5 py-4 bg-white border-t border-amber-100 first:border-t-0 hover:bg-amber-50/60 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-800">{job.address}</div>
                  <span className="text-xs text-slate-400">{stagesDone}/4 stages complete</span>
                </div>
                <div className="text-sm text-slate-500 mt-0.5">{job.description}</div>
              </button>
            );
          })}
          {jobs.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400 bg-white">No jobs assigned to this client yet.</div>}
        </div>
      </div>
    </div>
  );
}

function BookInspectionSection({ project, onBookInspection }) {
  const [bookingId, setBookingId] = useState(null);
  const [dateDraft, setDateDraft] = useState("");
  const [error, setError] = useState("");

  const bookable = project.inspections.filter((i) => i.outcome === "pending");
  if (bookable.length === 0) return null;

  const startBooking = (insp) => {
    setBookingId(insp.id);
    setDateDraft(insp.date || toISODateOnly(earliestBookableInspectionDate()));
    setError("");
  };

  const submitBooking = () => {
    if (!isValidInspectionBookingDate(dateDraft)) {
      const suggestion = suggestedInspectionBookingDate(dateDraft);
      setError(`That date isn't available — inspections can't be booked on weekends, and need at least 1 business day's notice (2 if requested after 2pm). Try ${suggestion} instead.`);
      setDateDraft(suggestion);
      return;
    }
    onBookInspection(bookingId, dateDraft);
    setBookingId(null);
    setError("");
  };

  return (
    <div className="rounded-lg overflow-hidden mb-5 border border-amber-200">
      <div className="px-5 py-3 text-sm font-serif bg-slate-900 text-amber-300">Book an Inspection</div>
      <div className="bg-white divide-y divide-amber-100">
        {bookable.map((insp) => (
          <div key={insp.id} className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm text-slate-800">{insp.title}</div>
                <div className="text-xs text-slate-400">{insp.date ? `Requested for ${insp.date}` : "Not yet booked"}</div>
              </div>
              {bookingId !== insp.id && (
                <button onClick={() => startBooking(insp)} className="px-3 py-1.5 rounded-md bg-slate-900 text-amber-200 text-xs font-medium whitespace-nowrap">
                  {insp.date ? "Change date" : "Book"}
                </button>
              )}
            </div>
            {bookingId === insp.id && (
              <div className="mt-3">
                <div className="flex flex-col sm:flex-row gap-2 items-start">
                  <input
                    type="date"
                    value={dateDraft}
                    onChange={(e) => { setDateDraft(e.target.value); setError(""); }}
                    className="px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={submitBooking} className="px-3 py-1.5 rounded-md bg-slate-900 text-amber-200 text-xs font-medium">Confirm</button>
                    <button onClick={() => setBookingId(null)} className="px-3 py-1.5 rounded-md text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                  </div>
                </div>
                {error && <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">{error}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="px-5 py-2 text-[11px] text-slate-400 bg-white border-t border-amber-100">
        Inspections need at least 1 business day's notice (2 if requested after 2pm) and can't be booked on weekends.
      </div>
    </div>
  );
}

function ClientPortalView({ project, onSimulateUpload, onBookInspection, onExit, exitLabel, onShareAccess, onRemoveSharedAccess }) {
  const [expandedStage, setExpandedStage] = useState(null); // null | project.pathway | "NOC" | "OC"
  const [shareOpen, setShareOpen] = useState(false);
  const [shareName, setShareName] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const toggleStage = (key) => setExpandedStage((prev) => (prev === key ? null : key));

  const submitShare = () => {
    if (!shareName.trim() || !shareEmail.trim()) return;
    onShareAccess(shareName.trim(), shareEmail.trim());
    setShareName("");
    setShareEmail("");
    setShareOpen(false);
  };

  const cdcComplete = stageComplete(project.checklists[project.pathway]);
  const nocComplete = stageComplete(project.checklists.NOC);
  const nocLocked = !cdcComplete;
  const ocLocked = !nocComplete;

  const issuedCerts = [];
  if (project.certificateRecords.pathway.approvalUploaded) {
    issuedCerts.push({ label: `${project.pathway} Certificate`, date: project.certificateRecords.pathway.approvalDate });
  }
  project.certificateRecords.pathway.modifications.forEach((m, idx) => {
    if (m.generated) issuedCerts.push({ label: `Modification ${idx + 1}`, date: m.generatedDate });
  });
  ocRecords(project).forEach((r, idx) => {
    if (r.approvalUploaded) issuedCerts.push({ label: `Occupation Certificate ${idx + 1} (${r.type === "whole" ? "Whole" : "Partial"})`, date: r.approvalDate });
  });

  const sentReports = project.inspections.filter((i) => i.reportSent);

  return (
    <div className="w-full min-h-screen font-sans bg-amber-50/30">
      <div className="px-6 py-5 flex items-center justify-between bg-slate-900 border-b border-amber-900/40">
        <div>
          <div className="font-serif text-xl tracking-tight text-amber-300">{FIRM.name}</div>
          <div className="text-[11px] tracking-[0.15em] uppercase mt-0.5 text-slate-400">Client Portal</div>
        </div>
        <button onClick={onExit} className="text-xs px-3 py-1.5 rounded-md border border-amber-800/40 text-slate-200 hover:bg-slate-800 transition-colors">
          {exitLabel || "Exit client preview"}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="text-xs rounded-md px-3.5 py-2.5 mb-6 bg-amber-100 border border-amber-300 text-amber-900">
          Preview only — this is what your client would see. Real client login and uploads need the real build.
        </div>

        {onShareAccess && (
          <div className="rounded-lg overflow-hidden mb-5 border border-amber-200">
            <div className="px-5 py-3 text-sm font-serif bg-slate-900 text-amber-300 flex items-center justify-between">
              <span>Give the owner access to this job</span>
              {!shareOpen && (
                <button onClick={() => setShareOpen(true)} className="text-xs font-sans bg-amber-800/40 hover:bg-amber-800/60 px-2.5 py-1 rounded-md text-amber-100">
                  + Share access
                </button>
              )}
            </div>
            <div className="bg-white px-5 py-4">
              <p className="text-xs mb-3" style={{ color: "#8A8478" }}>
                Add the owner's name and email so they can upload documents for this job's CDC/CC, NOC, and OC stages.
              </p>
              {(project.sharedAccess || []).length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {project.sharedAccess.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{s.name} <span className="text-slate-400">({s.email})</span></span>
                      <button onClick={() => onRemoveSharedAccess(s.id)} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
              {shareOpen && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input value={shareName} onChange={(e) => setShareName(e.target.value)} placeholder="Owner's name" className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  <input value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="Owner's email" className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  <button onClick={submitShare} className="px-3.5 py-2 rounded-md bg-slate-900 text-amber-200 text-sm font-medium">Send access</button>
                </div>
              )}
            </div>
          </div>
        )}

        <h1 className="font-serif text-2xl text-slate-900">{project.address}</h1>
        <p className="mt-1.5 mb-5 text-slate-500">{project.description}</p>

        <div className="flex gap-1.5 mb-7">
          <StagePill label={project.pathway} done={stageComplete(project.checklists[project.pathway])} />
          <StagePill label="NOC" done={stageComplete(project.checklists.NOC)} />
          <StagePill label="Inspections" done={inspectionsComplete(project)} />
          <StagePill label="OC" done={hasWholeOC(project)} />
        </div>

        <ClientChecklistCard
          title={`Prior to ${project.pathway}`}
          stageKey={project.pathway}
          items={project.checklists[project.pathway]}
          expanded={expandedStage === project.pathway}
          onToggle={() => toggleStage(project.pathway)}
          locked={false}
          onSimulateUpload={onSimulateUpload}
        />
        <ClientChecklistCard
          title="Principal Certifier Appointment and Issuance of the Notice of Commencement of Works"
          stageKey="NOC"
          items={project.checklists.NOC}
          expanded={expandedStage === "NOC"}
          onToggle={() => toggleStage("NOC")}
          locked={nocLocked}
          lockedReason={`Available once Prior to ${project.pathway} is complete`}
          onSimulateUpload={onSimulateUpload}
        />

        {nocComplete && <BookInspectionSection project={project} onBookInspection={onBookInspection} />}

        <ClientChecklistCard
          title="Prior to Occupation Certificate"
          stageKey="OC"
          items={project.checklists.OC}
          expanded={expandedStage === "OC"}
          onToggle={() => toggleStage("OC")}
          locked={ocLocked}
          lockedReason="Available once the Notice of Commencement stage is complete"
          onSimulateUpload={onSimulateUpload}
        />

        {project.conditions.length > 0 && pathwayIssued(project) && (
          <div className="rounded-lg overflow-hidden mb-5 border border-amber-200">
            <div className="px-5 py-3 text-sm font-serif bg-slate-900 text-amber-300">Conditions of Consent</div>
            <ol className="list-decimal pl-9 pr-5 py-4 space-y-1.5 text-sm bg-white text-slate-700">
              {project.conditions.map((c) => (
                <li key={c.id}>{c.text}</li>
              ))}
            </ol>
          </div>
        )}

        {sentReports.length > 0 && (
          <div className="rounded-lg overflow-hidden mb-5 border border-amber-200">
            <div className="px-5 py-3 text-sm font-serif bg-slate-900 text-amber-300">Inspection Reports</div>
            {sentReports.map((i) => (
              <div key={i.id} className="flex items-center justify-between px-5 py-3 bg-white border-t border-amber-100">
                <div>
                  <div className="font-medium text-sm text-slate-800">{i.title}</div>
                  <div className="text-xs text-slate-400">
                    {formatISODate(i.date)} · {i.outcome === "passed" ? "Passed" : i.outcome === "passed_subject_to" ? "Passed subject to conditions" : "Failed"}
                  </div>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors">
                  <Download size={14} /> Download
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg overflow-hidden mb-5 border border-amber-200">
          <div className="px-5 py-3 text-sm font-serif bg-slate-900 text-amber-300">Your Certificates</div>
          {issuedCerts.length === 0 ? (
            <div className="px-5 py-6 text-sm bg-white text-slate-400">Nothing has been issued yet — check back once your certifier has approved everything required.</div>
          ) : (
            issuedCerts.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 bg-white border-t border-amber-100">
                <div>
                  <div className="font-medium text-sm text-slate-800">{c.label}</div>
                  <div className="text-xs text-slate-400">Issued {c.date}</div>
                </div>
                <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 transition-colors">
                  <Download size={14} /> Download
                </button>
              </div>
            ))
          )}
        </div>

        <div className="text-center text-xs mt-10 text-slate-400">
          Questions about your project? Contact {FIRM.name} on {FIRM.phone} or {FIRM.email}.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project detail
// ---------------------------------------------------------------------------

function ProjectDetail({ project, certifiers, onBack, onEditDetails, onAddItems, onUploadItem, onResubmitItem, onApproveItem, onReopenItem, onAddPoint, onTogglePoint, onRemovePoint, onSetDocMeta, onRemoveItem, onSetInspectionOutcome, onAddDefect, onToggleDefect, onRemoveDefect, onSetInspector, onSetInspectionDate, onSendReport, onReportPortal, onRemoveInspection, onAddPhotos, onRemovePhoto, onSetPhotoCaption, onConfirmBooking, onAddCondition, onRemoveCondition, onGenerateCertificate, onUploadApproval, onCreateModification, onGenerateModification, onIssueOC, onUploadOCApproval, onMarkComplete, onReopenJob, onPreviewClient, onNotifyClient, onToggleCriticalStageInspection, onSaveCouncilLetter, onSaveApplicantLetter }) {
  const [tab, setTab] = useState("details");
  const [checklistJumpKey, setChecklistJumpKey] = useState(project.pathway);
  const goToChecklist = (stageKey) => {
    setChecklistJumpKey(stageKey);
    if (stageKey === "NOC") setTab("priorPca");
    else if (stageKey === "OC") setTab("priorOc");
    else setTab("priorCdc"); // covers the original pathway checklist and any modification
  };
  const tabs = [
    { key: "details", label: "Details", icon: Info },
    { key: "priorCdc", label: `Prior to ${project.pathway}`, icon: ClipboardCheck },
    { key: "priorPca", label: "Prior to PCA", icon: ClipboardCheck },
    { key: "inspections", label: "Inspections", icon: CalendarCheck },
    { key: "priorOc", label: "Prior to OC", icon: ClipboardCheck },
    { key: "approvals", label: "Approvals", icon: FileText },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="px-6 pt-6 pb-4 bg-white border-b border-slate-100">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-800 mb-3">
          <ArrowLeft size={14} /> All jobs
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-teal-900 flex items-center gap-2">
              {project.address}
              {project.status === "complete" && <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-700 text-white">Completed</span>}
            </h1>
            <div className="flex gap-1.5 mt-2">
              <StagePill label={project.pathway} done={stageComplete(project.checklists[project.pathway])} progress={checklistProgress(project.checklists[project.pathway])} />
              <StagePill label="NOC" done={stageComplete(project.checklists.NOC)} progress={checklistProgress(project.checklists.NOC)} />
              <StagePill label="INSP" done={inspectionsComplete(project)} progress={inspectionProgress(project)} />
              <StagePill label="OC" done={stageComplete(project.checklists.OC)} progress={checklistProgress(project.checklists.OC)} />
            </div>
            <p className="text-slate-500 mt-2">{project.description}</p>
            {!pathwayIssued(project) && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 mt-3 w-fit">
                <Lock size={12} />
                Issuing the OC is locked until the {project.pathway} certificate is issued from Approvals &amp; Forms. Every checklist, and Inspections, can still be prepared now.
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <a
              href={buildJobUpdateMailto(project)}
              onClick={onNotifyClient}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 whitespace-nowrap"
            >
              <Mail size={14} /> Notify client of updates
            </a>
            <span className="text-[11px] text-slate-400">Will reference: {currentStage(project).label}</span>
            {project.lastNotifiedAt && <span className="text-[11px] text-slate-400">Last notified {project.lastNotifiedAt}</span>}
            <button onClick={onPreviewClient} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-200 text-sm text-teal-800 font-medium hover:bg-slate-50 whitespace-nowrap">
              <UploadCloud size={14} /> Preview as client
            </button>
            {project.status !== "complete" && hasWholeOC(project) && (
              <button onClick={onMarkComplete} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 whitespace-nowrap">
                <Check size={14} /> Mark job complete
              </button>
            )}
            {project.status === "complete" && (
              <button onClick={onReopenJob} className="text-xs text-slate-400 hover:text-slate-600 hover:underline whitespace-nowrap">Reopen job</button>
            )}
          </div>
        </div>

        <div className="flex gap-4 mt-5 overflow-x-auto -mx-6 px-6" style={{ scrollbarWidth: "none" }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${active ? "text-teal-900 border-red-500" : "text-slate-500 border-transparent hover:text-teal-800"}`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "details" && <DetailsTab project={project} onEdit={onEditDetails} onAddCondition={onAddCondition} onRemoveCondition={onRemoveCondition} />}
      {tab === "priorCdc" && (
        <PriorCdcTab
          key={checklistJumpKey}
          project={project}
          initialModId={checklistJumpKey !== project.pathway ? checklistJumpKey : null}
          onAddItems={onAddItems}
          onUploadItem={onUploadItem}
          onResubmitItem={onResubmitItem}
          onApproveItem={onApproveItem}
          onReopenItem={onReopenItem}
          onAddPoint={onAddPoint}
          onTogglePoint={onTogglePoint}
          onRemovePoint={onRemovePoint}
          onSetDocMeta={onSetDocMeta}
          onRemoveItem={onRemoveItem}
        />
      )}
      {tab === "priorPca" && (
        <SingleChecklistView
          project={project}
          stageKey="NOC"
          stageLabel="Prior to Principal Certifier Appointment"
          onAddItems={onAddItems}
          onUploadItem={onUploadItem}
          onResubmitItem={onResubmitItem}
          onApproveItem={onApproveItem}
          onReopenItem={onReopenItem}
          onAddPoint={onAddPoint}
          onTogglePoint={onTogglePoint}
          onRemovePoint={onRemovePoint}
          onSetDocMeta={onSetDocMeta}
          onRemoveItem={onRemoveItem}
        />
      )}
      {tab === "priorOc" && (
        <SingleChecklistView
          project={project}
          stageKey="OC"
          stageLabel="Prior to OC"
          onAddItems={onAddItems}
          onUploadItem={onUploadItem}
          onResubmitItem={onResubmitItem}
          onApproveItem={onApproveItem}
          onReopenItem={onReopenItem}
          onAddPoint={onAddPoint}
          onTogglePoint={onTogglePoint}
          onRemovePoint={onRemovePoint}
          onSetDocMeta={onSetDocMeta}
          onRemoveItem={onRemoveItem}
        />
      )}
      {tab === "inspections" && (
        <InspectionsTab
          project={project}
          certifiers={certifiers}
          onSetOutcome={onSetInspectionOutcome}
          onAddDefect={onAddDefect}
          onToggleDefect={onToggleDefect}
          onRemoveDefect={onRemoveDefect}
          onSetInspector={onSetInspector}
          onSetDate={onSetInspectionDate}
          onSendReport={onSendReport}
          onReportPortal={onReportPortal}
          onRemoveInspection={onRemoveInspection}
          onAddPhotos={onAddPhotos}
          onRemovePhoto={onRemovePhoto}
          onSetPhotoCaption={onSetPhotoCaption}
          onConfirmBooking={onConfirmBooking}
        />
      )}
      {tab === "approvals" && (
        <ApprovalsTab
          project={project}
          certifiers={certifiers}
          onGenerate={onGenerateCertificate}
          onUploadApproval={onUploadApproval}
          onCreateModification={onCreateModification}
          onGenerateModification={onGenerateModification}
          onIssueOC={onIssueOC}
          onUploadOCApproval={onUploadOCApproval}
          onGoToChecklist={goToChecklist}
          onToggleCriticalStageInspection={onToggleCriticalStageInspection}
          onSaveCouncilLetter={onSaveCouncilLetter}
          onSaveApplicantLetter={onSaveApplicantLetter}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function CertFlowClientPortal() {
  const [projects, setProjects] = useState(SEED_PROJECTS);
  const [selectedId, setSelectedId] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [certifiers, setCertifiers] = useState(defaultCertifiers());
  const [clients, setClients] = useState([]);
  const [clientPreviewClientId, setClientPreviewClientId] = useState(null); // set when previewing all of a client's jobs
  const [clientPreviewJobId, setClientPreviewJobId] = useState(null);
  const [view, setView] = useState("dashboard"); // "dashboard" | "list" | "form" | "detail" | "quoteList" | "quoteForm" | "reports" | "audit" | "settings" | "clientPreview"

  const selected = projects.find((p) => p.id === selectedId) || null;
  const selectedQuote = quotes.find((q) => q.id === selectedQuoteId) || null;

  const handleAddClient = (data) => setClients((prev) => [...prev, makeClient(data)]);
  const handleRemoveClient = (id) => setClients((prev) => prev.filter((c) => c.id !== id));

  const handleAddCertifier = (name, registrationNo, registrationBody) =>
    setCertifiers((prev) => [...prev, { id: uid(), name, registrationNo, registrationBody, signatureUrl: "", piInsuranceExpiry: "", registrationExpiry: "" }]);
  const handleRemoveCertifier = (id) => setCertifiers((prev) => prev.filter((c) => c.id !== id));
  const handleSetCertifierSignature = (id, file) => {
    const url = URL.createObjectURL(file);
    setCertifiers((prev) => prev.map((c) => (c.id === id ? { ...c, signatureUrl: url } : c)));
  };
  const handleSetCertifierExpiry = (id, field, value) => setCertifiers((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

  const updateProject = (id, updater) => setProjects((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  const updateQuote = (id, updater) => setQuotes((prev) => prev.map((q) => (q.id === id ? updater(q) : q)));

  const handleOpenJob = (id) => {
    updateProject(id, (p) => ({ ...p, lastViewedAt: Date.now() }));
    setSelectedId(id);
    setView("detail");
  };

  const handleNewQuote = () => {
    setSelectedQuoteId(null);
    setView("quoteForm");
  };

  const handleOpenQuote = (id) => {
    setSelectedQuoteId(id);
    setView("quoteForm");
  };

  const handleSaveQuote = (data) => {
    if (quotes.some((q) => q.id === data.id)) {
      updateQuote(data.id, () => data);
    } else {
      setQuotes((prev) => [data, ...prev]);
    }
    setSelectedQuoteId(data.id);
    setView("quoteList");
  };

  const handleCancelQuoteForm = () => setView("quoteList");

  const handleSetQuoteStatus = (id, status) => updateQuote(id, (q) => ({ ...q, status }));
  const handleMarkQuotePaid = (id) => updateQuote(id, (q) => ({ ...q, paymentStatus: "paid", paymentReceivedDate: today() }));

  const handleGenerateJobFromQuote = (id) => {
    const q = quotes.find((x) => x.id === id);
    if (!q) return;
    const details = emptyDetails();
    details.zoning = "";
    details.contact.nameOrCompany = q.applicant.name;
    details.contact.phone = q.applicant.phone;
    details.contact.email = q.applicant.email;
    details.applicantAddress = { ...q.applicant.address };
    details.ownerSameAsApplicant = q.ownerIsApplicant;
    if (!q.ownerIsApplicant) {
      details.owner.name = q.owner.name;
      details.owner.phone = q.owner.phone;
    }
    details.council.lga = q.councilLga;
    details.proposal.classifications = q.classifications;
    details.certificateDetails.lotSectionDp = q.lotSectionPlan;

    const newJob = makeProject({
      address: q.proposalAddress,
      description: q.developmentDescription || "No description provided",
      types: q.projectType ? [q.projectType] : [],
      pathway: q.pathway,
      certifierId: certifiers[0]?.id,
      clientId: q.clientId || null,
      details,
    });
    setProjects((prev) => [newJob, ...prev]);
    updateQuote(id, (quote) => ({ ...quote, linkedJobId: newJob.id }));
    setSelectedId(newJob.id);
    setView("detail");
  };

  const handleNewJob = () => {
    setSelectedId(null);
    setView("form");
  };

  const handleEditDetails = () => setView("form");

  const handleSaveJobForm = (data) => {
    if (selectedId) {
      updateProject(selectedId, (p) => ({ ...p, ...data }));
      setView("detail");
    } else {
      const p = makeProject(data);
      setProjects((prev) => [p, ...prev]);
      setSelectedId(p.id);
      setView("detail");
    }
  };

  const handleCancelForm = () => setView(selectedId ? "detail" : "list");

  const mapItem = (stageKey, itemId, fn) =>
    updateProject(selectedId, (p) => ({ ...p, checklists: { ...p.checklists, [stageKey]: p.checklists[stageKey].map((i) => (i.id === itemId ? fn(i) : i)) } }));

  const handleAddItems = (stageKey, newItems) =>
    updateProject(selectedId, (p) => ({ ...p, checklists: { ...p.checklists, [stageKey]: [...p.checklists[stageKey], ...newItems.map((i) => ({ category: "Other", ...i, id: uid(), status: "requested", date: "Requested", amendments: [], version: 0, revision: "", documentDate: "", preparedBy: "", drawingNumber: "", clauseRef: "", requiresStamping: false, pendingReview: false }))] } }));

  const handleUploadItem = (stageKey, itemId) => mapItem(stageKey, itemId, (i) => ({ ...i, status: "submitted", date: today(), version: (i.version || 0) + 1 }));
  const handleResubmitItem = (stageKey, itemId) => mapItem(stageKey, itemId, (i) => ({ ...i, status: "submitted", date: today(), version: (i.version || 0) + 1, pendingReview: true }));
  const handleClientSimulateUpload = (stageKey, item) => (item.status === "requested" ? handleUploadItem(stageKey, item.id) : handleResubmitItem(stageKey, item.id));

  const handleBookInspection = (projectId, inspectionId, date) =>
    updateProject(projectId, (p) => ({ ...p, inspections: p.inspections.map((i) => (i.id === inspectionId ? { ...i, date, bookedByClient: true, confirmed: false } : i)) }));
  const handleConfirmInspectionBooking = (itemId) => mapInspection(itemId, (i) => ({ ...i, confirmed: true }));

  const handleShareAccess = (projectId, name, email) =>
    updateProject(projectId, (p) => ({ ...p, sharedAccess: [...(p.sharedAccess || []), { id: uid(), name, email, addedDate: today() }] }));
  const handleRemoveSharedAccess = (projectId, accessId) =>
    updateProject(projectId, (p) => ({ ...p, sharedAccess: (p.sharedAccess || []).filter((s) => s.id !== accessId) }));

  const handlePreviewClient = (project) => {
    if (project.clientId) {
      setClientPreviewClientId(project.clientId);
      setClientPreviewJobId(project.id);
    } else {
      setClientPreviewClientId(null);
      setClientPreviewJobId(project.id);
    }
    setView("clientPreview");
  };
  const handleApproveItem = (stageKey, itemId) => mapItem(stageKey, itemId, (i) => ({ ...i, status: "approved", date: today() }));
  const handleReopenItem = (stageKey, itemId) => mapItem(stageKey, itemId, (i) => ({ ...i, status: "submitted" }));
  const handleAddPoint = (stageKey, itemId, text) => mapItem(stageKey, itemId, (i) => ({ ...i, amendments: [...(i.amendments || []), { id: uid(), text, date: today(), resolved: false }], pendingReview: false }));
  const handleTogglePoint = (stageKey, itemId, pointId) => mapItem(stageKey, itemId, (i) => ({ ...i, amendments: i.amendments.map((a) => (a.id === pointId ? { ...a, resolved: !a.resolved } : a)) }));
  const handleRemovePoint = (stageKey, itemId, pointId) => mapItem(stageKey, itemId, (i) => ({ ...i, amendments: i.amendments.filter((a) => a.id !== pointId) }));
  const handleSetDocMeta = (stageKey, itemId, patch) => mapItem(stageKey, itemId, (i) => ({ ...i, ...patch }));
  const handleRemoveItem = (stageKey, itemId) => updateProject(selectedId, (p) => ({ ...p, checklists: { ...p.checklists, [stageKey]: p.checklists[stageKey].filter((i) => i.id !== itemId) } }));

  const mapInspection = (itemId, fn) => updateProject(selectedId, (p) => ({ ...p, inspections: p.inspections.map((i) => (i.id === itemId ? fn(i) : i)) }));

  const handleSetInspector = (itemId, inspectorName, inspectorLicense) => mapInspection(itemId, (i) => ({ ...i, inspectorName, inspectorLicense }));
  const handleSetInspectionOutcome = (itemId, outcome) => mapInspection(itemId, (i) => ({ ...i, outcome, date: i.date || todayISO() }));
  const handleSetInspectionDate = (itemId, isoDate) => mapInspection(itemId, (i) => ({ ...i, date: isoDate }));
  const handleAddDefect = (itemId, text) => mapInspection(itemId, (i) => ({ ...i, defects: [...(i.defects || []), { id: uid(), text, resolved: false }] }));
  const handleToggleDefect = (itemId, defectId) => mapInspection(itemId, (i) => ({ ...i, defects: i.defects.map((d) => (d.id === defectId ? { ...d, resolved: !d.resolved } : d)) }));
  const handleRemoveDefect = (itemId, defectId) => mapInspection(itemId, (i) => ({ ...i, defects: i.defects.filter((d) => d.id !== defectId) }));
  const handleSendReport = (itemId) => mapInspection(itemId, (i) => ({ ...i, reportSent: true, reportSentDate: today() }));
  const handleReportPortal = (itemId) => mapInspection(itemId, (i) => ({ ...i, portalReported: true, portalReportedDate: today() }));

  // Photos are read straight from the file the certifier selects — real
  // image data for the session (via a local object URL), not a simulation.
  // It just doesn't persist past a refresh yet, same as everything else
  // here, until the real backend has file storage.
  const handleAddPhotos = (itemId, files) => {
    const newPhotos = [...files].map((file) => ({ id: uid(), url: URL.createObjectURL(file), fileName: file.name, caption: "" }));
    mapInspection(itemId, (i) => ({ ...i, photos: [...(i.photos || []), ...newPhotos] }));
  };
  const handleRemovePhoto = (itemId, photoId) => mapInspection(itemId, (i) => ({ ...i, photos: (i.photos || []).filter((p) => p.id !== photoId) }));
  const handleSetPhotoCaption = (itemId, photoId, caption) =>
    mapInspection(itemId, (i) => ({ ...i, photos: (i.photos || []).map((p) => (p.id === photoId ? { ...p, caption } : p)) }));

  const handleToggleCriticalStageInspection = (no) =>
    updateProject(selectedId, (p) => ({
      ...p,
      criticalStageInspections: (p.criticalStageInspections || []).includes(no)
        ? p.criticalStageInspections.filter((n) => n !== no)
        : [...(p.criticalStageInspections || []), no],
    }));
  const handleSaveCouncilLetter = (text) => updateProject(selectedId, (p) => ({ ...p, councilLetterOverride: text }));
  const handleSaveApplicantLetter = (text) => updateProject(selectedId, (p) => ({ ...p, applicantLetterOverride: text }));
  const handleRemoveInspection = (itemId) => updateProject(selectedId, (p) => ({ ...p, inspections: p.inspections.filter((i) => i.id !== itemId) }));

  const handleAddCondition = (text) => updateProject(selectedId, (p) => ({ ...p, conditions: [...p.conditions, { id: uid(), text, dateAdded: today() }] }));
  const handleRemoveCondition = (conditionId) => updateProject(selectedId, (p) => ({ ...p, conditions: p.conditions.filter((c) => c.id !== conditionId) }));

  const handleGenerateCertificate = (certifierId, determinationDate) => {
    const issuer = certifiers.find((c) => c.id === certifierId) || certifiers[0];
    const issuedBy = issuer ? { name: issuer.name, registrationNo: issuer.registrationNo, registrationBody: issuer.registrationBody } : null;
    updateProject(selectedId, (p) => ({
      ...p,
      details: {
        ...p.details,
        certificateDetails: {
          ...p.details.certificateDetails,
          determinationDate: determinationDate || p.details.certificateDetails.determinationDate,
        },
      },
      certificateRecords: {
        ...p.certificateRecords,
        pathway: { ...p.certificateRecords.pathway, generated: true, generatedDate: today(), issuedBy, version: (p.certificateRecords.pathway.version || 0) + 1, approvalUploaded: false, approvalDate: "" },
      },
    }));
  };

  const handleUploadApproval = () =>
    updateProject(selectedId, (p) => ({ ...p, certificateRecords: { ...p.certificateRecords, pathway: { ...p.certificateRecords.pathway, approvalUploaded: true, approvalDate: today() } } }));

  // Step 1: create a modification — this builds it its own checklist (same
  // library as the original CDC/CC) so updated documents can be requested
  // and approved before the modification is actually issued.
  const handleCreateModification = (reason) => {
    const modId = uid();
    updateProject(selectedId, (p) => ({
      ...p,
      checklists: {
        ...p.checklists,
        [modId]: DOC_LIBRARY[p.pathway].map((doc) => ({ ...doc, id: uid(), status: "requested", date: "Requested", amendments: [], version: 0, revision: "", documentDate: "", preparedBy: "", drawingNumber: "", clauseRef: "", requiresStamping: false, pendingReview: false })),
      },
      certificateRecords: {
        ...p.certificateRecords,
        pathway: { ...p.certificateRecords.pathway, modifications: [...p.certificateRecords.pathway.modifications, { id: modId, reason, generated: false, generatedDate: "", issuedBy: null }] },
      },
    }));
  };

  // Step 2: once that modification's checklist is fully approved, issue it.
  const handleGenerateModification = (modId, certifierId) => {
    const issuer = certifiers.find((c) => c.id === certifierId) || certifiers[0];
    const issuedBy = issuer ? { name: issuer.name, registrationNo: issuer.registrationNo, registrationBody: issuer.registrationBody } : null;
    updateProject(selectedId, (p) => ({
      ...p,
      certificateRecords: {
        ...p.certificateRecords,
        pathway: {
          ...p.certificateRecords.pathway,
          modifications: p.certificateRecords.pathway.modifications.map((m) => (m.id === modId ? { ...m, generated: true, generatedDate: today(), issuedBy } : m)),
        },
      },
    }));
  };

  const handleIssueOC = (type, description, certifierId) => {
    const issuer = certifiers.find((c) => c.id === certifierId) || certifiers[0];
    const issuedBy = issuer ? { name: issuer.name, registrationNo: issuer.registrationNo, registrationBody: issuer.registrationBody } : null;
    updateProject(selectedId, (p) => ({
      ...p,
      certificateRecords: {
        ...p.certificateRecords,
        oc: { records: [...p.certificateRecords.oc.records, { id: uid(), type, description, generatedDate: today(), issuedBy, approvalUploaded: false, approvalDate: "" }] },
      },
    }));
  };

  const handleUploadOCApproval = (recordId) =>
    updateProject(selectedId, (p) => ({
      ...p,
      certificateRecords: {
        ...p.certificateRecords,
        oc: { records: p.certificateRecords.oc.records.map((r) => (r.id === recordId ? { ...r, approvalUploaded: true, approvalDate: today() } : r)) },
      },
    }));

  const handleMarkComplete = () => updateProject(selectedId, (p) => ({ ...p, status: "complete" }));
  const handleReopenJob = () => updateProject(selectedId, (p) => ({ ...p, status: "active" }));
  const handleNotifyClient = () => updateProject(selectedId, (p) => ({ ...p, lastNotifiedAt: today() }));

  const topClientName = selected
    ? selected.details.contact.nameOrCompany ||
      [selected.details.contact.title, selected.details.contact.givenNames, selected.details.contact.surname].filter(Boolean).join(" ") ||
      selected.address
    : "";

  return (
    <div className="w-full min-h-screen bg-slate-50 font-sans">
      {view === "clientPreview" ? null : ["dashboard", "list", "quoteList", "quoteForm", "reports", "audit", "settings"].includes(view) ? (
        <NavBar
          onHome={() => setView("dashboard")}
          onNewJob={handleNewJob}
          onListAll={() => setView("list")}
          onNewQuote={handleNewQuote}
          onListQuotes={() => setView("quoteList")}
          onReports={() => setView("reports")}
          onAudit={() => setView("audit")}
          onSettings={() => setView("settings")}
        />
      ) : (
        <TopBar clientName={topClientName} onBack={() => { setSelectedId(null); setView("dashboard"); }} showBack={true} />
      )}

      {view === "dashboard" && (
        <Dashboard projects={projects} certifiers={certifiers} onOpenJob={handleOpenJob} onNewJob={handleNewJob} onListAll={() => setView("list")} onSettings={() => setView("settings")} />
      )}

      {view === "list" && <ProjectList projects={projects} certifiers={certifiers} onSelect={handleOpenJob} onNewJob={handleNewJob} />}

      {view === "quoteList" && <QuoteList quotes={quotes} onSelect={handleOpenQuote} onNewQuote={handleNewQuote} />}

      {view === "quoteForm" && (
        <QuoteForm
          initialQuote={selectedQuote}
          clients={clients}
          onSave={handleSaveQuote}
          onCancel={handleCancelQuoteForm}
          onSetStatus={handleSetQuoteStatus}
          onGenerateJob={handleGenerateJobFromQuote}
          onMarkPaid={handleMarkQuotePaid}
        />
      )}

      {view === "reports" && <ReportsPage projects={projects} />}
      {view === "audit" && <AuditPage projects={projects} certifiers={certifiers} />}

      {view === "settings" && (
        <SettingsPage
          certifiers={certifiers}
          onAdd={handleAddCertifier}
          onRemove={handleRemoveCertifier}
          onSetSignature={handleSetCertifierSignature}
          onSetExpiry={handleSetCertifierExpiry}
          clients={clients}
          onAddClient={handleAddClient}
          onRemoveClient={handleRemoveClient}
        />
      )}

      {view === "form" && <JobForm initialProject={selected} certifiers={certifiers} clients={clients} onSave={handleSaveJobForm} onCancel={handleCancelForm} />}

      {view === "detail" && selected && (
        <ProjectDetail
          project={selected}
          certifiers={certifiers}
          onBack={() => { setSelectedId(null); setView("list"); }}
          onEditDetails={handleEditDetails}
          onAddItems={handleAddItems}
          onUploadItem={handleUploadItem}
          onResubmitItem={handleResubmitItem}
          onApproveItem={handleApproveItem}
          onReopenItem={handleReopenItem}
          onAddPoint={handleAddPoint}
          onTogglePoint={handleTogglePoint}
          onRemovePoint={handleRemovePoint}
          onSetDocMeta={handleSetDocMeta}
          onRemoveItem={handleRemoveItem}
          onSetInspectionOutcome={handleSetInspectionOutcome}
          onAddDefect={handleAddDefect}
          onToggleDefect={handleToggleDefect}
          onRemoveDefect={handleRemoveDefect}
          onSetInspector={handleSetInspector}
          onSetInspectionDate={handleSetInspectionDate}
          onSendReport={handleSendReport}
          onReportPortal={handleReportPortal}
          onAddPhotos={handleAddPhotos}
          onRemovePhoto={handleRemovePhoto}
          onSetPhotoCaption={handleSetPhotoCaption}
          onConfirmBooking={handleConfirmInspectionBooking}
          onToggleCriticalStageInspection={handleToggleCriticalStageInspection}
          onSaveCouncilLetter={handleSaveCouncilLetter}
          onSaveApplicantLetter={handleSaveApplicantLetter}
          onRemoveInspection={handleRemoveInspection}
          onAddCondition={handleAddCondition}
          onRemoveCondition={handleRemoveCondition}
          onGenerateCertificate={handleGenerateCertificate}
          onUploadApproval={handleUploadApproval}
          onCreateModification={handleCreateModification}
          onGenerateModification={handleGenerateModification}
          onIssueOC={handleIssueOC}
          onUploadOCApproval={handleUploadOCApproval}
          onMarkComplete={handleMarkComplete}
          onReopenJob={handleReopenJob}
          onPreviewClient={() => handlePreviewClient(selected)}
          onNotifyClient={handleNotifyClient}
        />
      )}

      {view === "clientPreview" && clientPreviewClientId && (
        <ClientMultiJobView
          client={clients.find((c) => c.id === clientPreviewClientId)}
          jobs={projects.filter((p) => p.clientId === clientPreviewClientId)}
          initialJobId={clientPreviewJobId}
          onSimulateUpload={handleClientSimulateUpload}
          onBookInspection={handleBookInspection}
          onShareAccess={handleShareAccess}
          onRemoveSharedAccess={handleRemoveSharedAccess}
          onExit={() => setView("detail")}
        />
      )}

      {view === "clientPreview" && !clientPreviewClientId && clientPreviewJobId && (
        <ClientPortalView
          project={projects.find((p) => p.id === clientPreviewJobId)}
          onSimulateUpload={handleClientSimulateUpload}
          onBookInspection={(inspectionId, date) => handleBookInspection(clientPreviewJobId, inspectionId, date)}
          onExit={() => setView("detail")}
        />
      )}
    </div>
  );
}
