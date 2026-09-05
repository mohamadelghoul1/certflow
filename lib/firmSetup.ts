// What a firm still has to do before Certlyn works properly for them.
//
// A director signing in for the first time sees an empty dashboard.
// Nothing tells them their certificates will print without a logo, that
// their inspection reports have no signature to carry, or that their
// checklists are empty — they find out when a client asks why the CDC
// looks unfinished.
//
// So the dashboard says it plainly, and keeps saying it until each one
// is done. Every step links to the place it is fixed, and the list
// disappears of its own accord when the firm is set up: a checklist
// that lingers after it is finished is one more thing to ignore.

export type SetupFacts = {
  firmName: string | null;
  abn: string | null;
  officeAddress: string | null;
  phone: string | null;
  logoUrl: string | null;
  sendingAddressSet: boolean;
  certifiers: { registrationNo: string | null; signatureUrl: string | null }[];
  libraryItems: number;
  clients: number;
  jobs: number;
  twoFactorOn: boolean;
};

export type SetupStep = {
  id: string;
  label: string;
  why: string;
  href: string;
  done: boolean;
  // A certificate issued without these is wrong on its face, so they
  // are worth saying more loudly than the rest.
  essential: boolean;
};

function filled(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0;
}

export function setupSteps(facts: SetupFacts): SetupStep[] {
  const withRegistration = facts.certifiers.filter((c) => filled(c.registrationNo));
  return [
    {
      id: "firm",
      label: "Fill in your firm's details",
      why: "The name, ABN, address and phone that print on every certificate, letter and invoice.",
      href: "/settings?section=firm",
      done: filled(facts.firmName) && filled(facts.abn) && filled(facts.officeAddress) && filled(facts.phone),
      essential: true,
    },
    {
      id: "logo",
      label: "Upload your logo",
      why: "Your letterhead. Without it, documents go out with a blank space where your firm's name should be.",
      href: "/settings?section=firm",
      done: filled(facts.logoUrl),
      essential: true,
    },
    {
      id: "certifier",
      label: "Add your certifiers and their registration numbers",
      why: "A certificate has to carry the registration of the person issuing it.",
      href: "/settings?section=certifiers",
      done: withRegistration.length > 0,
      essential: true,
    },
    {
      id: "signature",
      label: "Upload a signature for each certifier",
      why: "What signs your certificates and inspection reports.",
      href: "/settings?section=certifiers",
      done: withRegistration.length > 0 && withRegistration.every((c) => filled(c.signatureUrl)),
      essential: true,
    },
    {
      id: "email",
      label: "Set the address your emails come from",
      why: "So a client sees your firm's name on a certificate, and a reply reaches your inbox.",
      href: "/settings?section=email",
      done: facts.sendingAddressSet,
      essential: true,
    },
    {
      id: "library",
      label: "Check your document library",
      why: "What each checklist asks a client for. You start with the standard list — change the wording to your own.",
      href: "/settings?section=library",
      done: facts.libraryItems > 0,
      essential: false,
    },
    {
      id: "client",
      label: "Add your first client",
      why: "A contact with an email, so they can be given a portal login.",
      href: "/settings?section=clients",
      done: facts.clients > 0,
      essential: false,
    },
    {
      id: "job",
      label: "Create your first project",
      why: "Or bring your current ones across from a spreadsheet — imported projects are never charged for.",
      href: "/jobs/new",
      done: facts.jobs > 0,
      essential: false,
    },
    {
      id: "two-factor",
      label: "Turn on two-factor sign-in",
      why: "Your login reaches every project and every client document your firm holds.",
      href: "/settings?section=security",
      done: facts.twoFactorOn,
      essential: false,
    },
  ];
}

export function setupProgress(steps: SetupStep[]): { done: number; total: number; complete: boolean; essentialLeft: number } {
  const done = steps.filter((s) => s.done).length;
  return {
    done,
    total: steps.length,
    complete: done === steps.length,
    essentialLeft: steps.filter((s) => s.essential && !s.done).length,
  };
}

// The next thing worth doing, essentials first — what the panel leads
// with when it is collapsed.
export function nextStep(steps: SetupStep[]): SetupStep | null {
  return steps.find((s) => s.essential && !s.done) || steps.find((s) => !s.done) || null;
}
