import type { Certifier, Firm } from "@/types/db";

// Whose letterhead a document goes out on.
//
// Inspections are often carried out by a registered certifier working as
// a contractor rather than an employee — their own company, their own
// ABN, their own registration. Their inspection report belongs on their
// letterhead, because they are who attended.
//
// Only the inspection report follows this. A certificate, a covering
// letter and a pre-inspection report are the firm's own documents and
// stay on the firm's letterhead whoever is named on them.
//
// A certifier with no practice name is an employee — which is every
// certifier that exists before migration 0025 — and their reports carry
// the firm's letterhead exactly as before. The practice name is the test
// rather than any of the other fields, because a letterhead with an ABN
// and no company on it is worse than the firm's.

export type Letterhead = Pick<Firm, "name" | "abn" | "postal_address" | "office_address" | "phone" | "email" | "website" | "logo_url">;

export function isContractCertifier(certifier: Pick<Certifier, "practice_name"> | null | undefined) {
  return !!certifier?.practice_name?.trim();
}

export function letterheadFor(certifier: Certifier | null | undefined, firm: Firm | null): { letterhead: Letterhead | null; logoUrl: string | null | undefined } {
  if (!isContractCertifier(certifier) || !certifier) return { letterhead: firm, logoUrl: firm?.logo_url };

  return {
    letterhead: {
      name: certifier.practice_name || "",
      abn: certifier.practice_abn ?? null,
      postal_address: certifier.practice_postal_address ?? null,
      office_address: certifier.practice_office_address ?? null,
      phone: certifier.practice_phone ?? null,
      email: certifier.practice_email ?? null,
      website: certifier.practice_website ?? null,
      logo_url: certifier.practice_logo_url ?? null,
    },
    logoUrl: certifier.practice_logo_url,
  };
}
