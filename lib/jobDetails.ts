import type { JobDetails } from "@/types/db";

// What the Details form actually asks the database to change.
//
// The form rebuilds certificateDetails from its own boxes, but two
// fields in there are not its to set: the determination date is stamped
// when a certificate is issued, and the consent references are no longer
// entered on any form. Leaving them out of the patch is how they survive
// — a patch says what to change, and anything it does not mention is
// left exactly as it was.
//
// priorApproval is the opposite case. Only a PC/OC job carries one, and
// a job switched away from PC/OC must lose it, or another certifier's
// approval keeps printing on its documents. Omitting it would mean
// "leave it alone", so it is sent as an explicit null, which the merge
// reads as "remove this".
export function detailsPatchFromForm(fromForm: JobDetails): Record<string, unknown> {
  const patch: Record<string, unknown> = { ...fromForm };

  const certificateDetails = { ...(fromForm.certificateDetails || {}) } as Record<string, unknown>;
  delete certificateDetails.determinationDate;
  delete certificateDetails.consentReferences;
  patch.certificateDetails = certificateDetails;

  patch.priorApproval = fromForm.priorApproval ?? null;

  return patch;
}

// The same merge the database does, for the case where migration 0029
// has not been run yet. Kept beside the patch builder so the two stay in
// step: a null removes the key, an array is replaced whole, and objects
// merge key by key all the way down.
export function deepMergeDetails(existing: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return patch;

  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {};

  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === null) delete base[key];
    else if (value !== undefined && typeof value === "object" && !Array.isArray(value)) base[key] = deepMergeDetails(base[key], value);
    else if (value !== undefined) base[key] = value;
  }

  return base;
}
