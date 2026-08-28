import { randomBytes } from "node:crypto";

// Engagement agreements sent out for signature.
//
// The link in the email is the whole of the recipient's authorisation —
// an owner has no CertFlow login and shouldn't need one — so the token
// has to be long enough that guessing is hopeless, and URL-safe so it
// survives being pasted out of an email client.

export type Signatory = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  signed_at: string | null;
  signed_name: string | null;
  signature_image?: string | null;
  sent_at?: string | null;
};

export function newSignatureToken(): string {
  return randomBytes(32).toString("base64url");
}

export type AgreementProgress = { signed: number; total: number; complete: boolean; outstanding: Signatory[] };

export function agreementProgress(signatories: Signatory[]): AgreementProgress {
  const signed = signatories.filter((s) => !!s.signed_at);
  return {
    signed: signed.length,
    total: signatories.length,
    // An agreement with nobody named is not "complete" — it has simply
    // not been set up.
    complete: signatories.length > 0 && signed.length === signatories.length,
    outstanding: signatories.filter((s) => !s.signed_at),
  };
}

export function progressLabel(progress: AgreementProgress): string {
  if (progress.total === 0) return "No signatories added yet";
  if (progress.complete) return `Signed by all ${progress.total === 1 ? "parties" : `${progress.total} parties`}`;
  return `${progress.signed} of ${progress.total} signed`;
}

// A signatory's declaration has to match the name they were sent the
// agreement as. Not a legal requirement, but someone typing a different
// name is nearly always a person signing on another's behalf, which is
// exactly what the certifier needs to know about rather than discover
// during an audit. Compared loosely: case, spacing and middle initials
// are not the point.
export function nameMatches(expected: string, typed: string): boolean {
  const tidy = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
  const a = tidy(expected);
  const b = tidy(typed);
  if (a.length === 0 || b.length === 0) return false;
  // First and last word matching is enough — "Robert J Smith" signing as
  // "Robert Smith" is the same person.
  return a[0] === b[0] && a[a.length - 1] === b[b.length - 1];
}
