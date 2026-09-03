// The few facts the legal pages share, kept in one place so that when
// the operating entity is settled (its own company, ABN) it is changed
// here once and both pages follow.

export const OPERATOR_NAME = "Certlyn";
export const LEGAL_UPDATED = "3 September 2026";
export const GOVERNING_LAW = "New South Wales, Australia";

// Where a privacy or legal question goes: the contact address once
// there is one in Vercel, otherwise the form on the site.
export function legalContact(): { email: string | null; formPath: string } {
  return { email: process.env.CONTACT_EMAIL || null, formPath: "/join" };
}
