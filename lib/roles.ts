// Directors and team members.
//
// A firm has one or more directors, who run it, and any number of team
// members — employees or contract certifiers — who see the projects
// they have been given. The role sits on the certifier row so a director
// can set it before the person has a login. The database enforces it
// (migration 0072); what is here is the app's reading of the same facts.

export type FirmRole = "director" | "staff" | "inspector";

export const FIRM_ROLES: { value: FirmRole; label: string; blurb: string }[] = [
  { value: "director", label: "Director", blurb: "Runs the firm: every project, quotes, invoices, settings, and who is on the team." },
  { value: "staff", label: "Team member", blurb: "An employee or contract certifier. Sees the projects and inspections they are given, and nothing else." },
  {
    value: "inspector",
    label: "Inspector",
    blurb: "Carries out the inspections they are given. Reads the approved documents, records outcomes, issues and photos, signs the report — and cannot change the project or report to the NSW Planning Portal.",
  },
];

export function roleLabel(role: string | null | undefined): string {
  return FIRM_ROLES.find((r) => r.value === role)?.label || "Director";
}

export function isFirmRole(value: unknown): value is FirmRole {
  return FIRM_ROLES.some((r) => r.value === value);
}

// The role read off the person's own certifier card. Before migration
// 0072 the column does not exist, and every certifier is a director
// because that is what they have always been; any other failure reads
// the same way rather than locking a director out of their own firm
// over a hiccup. A login with no card at all is a director for the
// same reason — the earliest logins were linked by hand.
export function roleFromAnswer(value: unknown, error: { code?: string; message?: string } | null): FirmRole {
  if (error) return "director";
  return isFirmRole(value) ? value : "director";
}

// Whether this role changes what a project is — its details, documents,
// checklists, certificates. An inspector only reads those; the
// inspection work itself is judged separately.
export function canWriteJob(role: FirmRole): boolean {
  return role !== "inspector";
}

// A director may change anyone's role but their own — demoting yourself
// with nobody else in charge is a firm with no director, and the guard
// is simplest as "someone else does it".
export function canChangeRole(targetCertifierId: string, ownCertifierId: string | null): boolean {
  return targetCertifierId !== ownCertifierId;
}

// Which certifiers to add to and remove from a project's team, from what
// is there now and what the form asked for. The assigned certifier is
// never a "member" — the assignment itself opens the project — so a tick
// against them is dropped rather than stored twice.
export function teamChanges(current: string[], wanted: string[], assignedCertifierId: string | null): { add: string[]; remove: string[] } {
  const want = new Set(wanted.filter((id) => id && id !== assignedCertifierId));
  const have = new Set(current);
  return {
    add: [...want].filter((id) => !have.has(id)),
    remove: [...have].filter((id) => !want.has(id)),
  };
}

// Where a team member may go. Everything else in the certifier app is
// the director's: the list is what the navigation shows and what the
// pages check, so the two cannot drift apart.
export const STAFF_ROUTES = ["/dashboard", "/jobs", "/calendar", "/settings", "/site"] as const;

export function staffCanOpen(path: string): boolean {
  if (path.startsWith("/jobs/new") || path.startsWith("/jobs/import") || path.startsWith("/jobs/deleted")) return false;
  return STAFF_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}
