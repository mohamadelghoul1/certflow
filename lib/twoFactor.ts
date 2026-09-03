// Two-factor sign-in, the parts that are pure.
//
// Supabase does the cryptography — the authenticator secret, the
// six-digit codes, the assurance level on the session. What is decided
// here is only when to insist on the second step, and what a code
// typed by a person on a phone has to look like before it is sent.

export type AssuranceLevel = { currentLevel: string | null; nextLevel: string | null } | null | undefined;

// A session that could reach a higher level than it holds is a
// password-only session on an account that has an authenticator set
// up. That is the one case the second step is demanded in; an account
// with no authenticator has nothing to ask for.
export function needsSecondFactor(aal: AssuranceLevel): boolean {
  if (!aal) return false;
  return aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}

// Six digits, however they were typed: "123 456", "123-456", with a
// space pasted in from the authenticator app.
export function normaliseCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}
