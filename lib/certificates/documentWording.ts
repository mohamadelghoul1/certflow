// The words on a firm's approval documents.
//
// Three layers, and the order matters:
//
//   1. What this job says       — a certifier editing one letter on one job
//   2. What this firm says      — the firm's own standard wording (here)
//   3. What Certlyn says        — the built-in default
//
// A firm that has never opened the editor sits on layer 3 and prints
// exactly what it printed before this existed. That is not a claim, it
// is how this is wired: when there is no saved wording the callers fall
// through to the code they already had, untouched.
//
// The certificate's rows are edited elsewhere — Settings → Certificate
// layout, migration 0055. This is the prose around them: the letters to
// the council and the applicant, and the notice about inspections.

export const WORDING_KEYS = [
  "council.body",
  "applicant.body",
  "oc.council.body",
  "oc.applicant.body",
  "inspections.notice",
] as const;

export type WordingKey = (typeof WORDING_KEYS)[number];

// What a firm can drop into their wording. Written the way a person
// would say them rather than as code, because a certifier is going to
// type these by hand.
export const PLACEHOLDERS: { token: string; meaning: string }[] = [
  { token: "{FIRM}", meaning: "Your firm's name" },
  { token: "{FIRM ADDRESS}", meaning: "Your office address" },
  { token: "{CERTIFIER}", meaning: "The certifier who issued it" },
  { token: "{ADDRESS}", meaning: "The development address" },
  { token: "{PATHWAY}", meaning: "Complying Development Certificate, Construction Certificate, or the OC's type" },
  { token: "{CERTIFICATE NO}", meaning: "The certificate's own number" },
  { token: "{CONSENT}", meaning: "What the job was approved under — CDC or CC" },
  { token: "{CONSENT NO}", meaning: "That consent's number" },
  { token: "{DA NO}", meaning: "The development consent number, where there is one" },
  { token: "{COUNCIL}", meaning: "The council for the address" },
  { token: "{APPLICANT}", meaning: "The applicant or owner" },
];

export type WordingField = {
  key: WordingKey;
  label: string;
  help: string;
  // Shown in the editor when a firm has saved nothing, so they start
  // from the real wording rather than an empty box. Written with
  // placeholders, which is what the standard text amounts to once the
  // job's own facts are taken out of it.
  starting: string;
};

export const WORDING_FIELDS: WordingField[] = [
  {
    key: "council.body",
    label: "Letter to the council — CDC and CC",
    help: "Sent with a copy of the certificate. One paragraph per blank line.",
    starting: [
      "{FIRM} has issued a {PATHWAY} under Part 4 of the Environmental Planning and Assessment Act 1979 for the above premises.",
      "The applicant / owner has been advised to submit the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site.",
      "Should you need to discuss any issues, please do not hesitate to contact the Registered Building Surveyor {CERTIFIER}.",
    ].join("\n\n"),
  },
  {
    key: "applicant.body",
    label: "Letter to the applicant — CDC and CC",
    help: "Goes to the applicant or owner with their copy of the certificate.",
    starting: [
      "One copy of each has been forwarded directly to {COUNCIL} for their records.",
      "The Applicant / Owner is required to lodge the Appointment of a Principal Certifier to us through the NSW Planning Portal.",
      "Once our office accepts the Principal Certifier Appointment through the NSW Planning Portal the Applicant / Owner is required to lodge the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site.",
      "The Principal Certifier role to be undertaken by {CERTIFIER} will require inspections and certification.",
      "Please have the Owner/Builder or licensed contractor liaise with {CERTIFIER} prior to commencement of the work.",
      "Should you need to discuss any issues, please do not hesitate to contact the undersigned on the above numbers.",
    ].join("\n\n"),
  },
  {
    key: "oc.council.body",
    label: "Letter to the council — Occupation Certificate",
    help: "Sent with a copy of the OC.",
    starting: [
      "{FIRM} has issued an Occupation Certificate for the above-mentioned project under Sections 6.9, 6.10 of the Environmental Planning and Assessment Act 1979.",
      "Please find enclosed the following documentation:",
      "•  Occupation Certificate No. {CERTIFICATE NO}\n•  Documentation used to determine the Occupation Certificate",
      "Should you need to discuss any issues, please do not hesitate to contact the Principal Certifier, {CERTIFIER}, on the above numbers.",
    ].join("\n\n"),
  },
  {
    key: "oc.applicant.body",
    label: "Letter to the applicant — Occupation Certificate",
    help: "Goes to the applicant or owner with their copy of the OC. The standard letter adds the five-year condition on a partial OC and a thank-you on a whole one; a saved letter here is used for both kinds.",
    starting: [
      "In accordance with Sections 6.9, 6.10 of the Environmental Planning and Assessment Act 1979, we enclose an Occupation Certificate relating to the construction of the above project.",
      "As required under the legislation copies of the same have been forwarded to {COUNCIL} for their records.",
      "Should you need to discuss any issues, please do not hesitate to contact the Principal Certifier, {CERTIFIER}, on the above numbers.",
    ].join("\n\n"),
  },
  {
    key: "inspections.notice",
    label: "Notice about critical stage inspections",
    help: "The paragraph above Schedule 1 on the inspections notice.",
    starting:
      "I, {CERTIFIER} of {FIRM}, located at {FIRM ADDRESS}, acting as the principal certifier, hereby give notice in accordance with Section 58 of the Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to the person having the benefit of the development consent that the mandatory critical stage inspections identified in Schedule 1 are to be carried out in respect of the building work.",
  },
];

export type WordingValues = Partial<Record<string, string | null | undefined>>;

// Fills a firm's wording in with this job's facts.
//
// A placeholder with nothing behind it becomes an em dash rather than
// disappearing or printing its own name: a letter reading "issued by —"
// is obviously unfinished, where one reading "issued by {CERTIFIER}"
// looks like a software fault and one with a gap looks deliberate.
export function fillWording(text: string, values: WordingValues): string {
  return text.replace(/\{([A-Z ]+)\}/g, (whole, token: string) => {
    const value = values[token.trim()];
    if (value === undefined) return whole;
    return String(value || "").trim() || "—";
  });
}

// A firm writes paragraphs separated by a blank line, which is how the
// per-job letter override has always worked.
export function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// The firm's wording for one document, or null when they have not
// written any — in which case the caller keeps the default it already
// had, and nothing about that document changes.
export function firmWording(saved: Record<string, string> | null | undefined, key: WordingKey, values: WordingValues): string[] | null {
  const text = (saved?.[key] || "").trim();
  if (!text) return null;
  const filled = paragraphsOf(fillWording(text, values));
  return filled.length > 0 ? filled : null;
}
