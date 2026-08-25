import type { JobDetails } from "@/types/db";

// What a job's details become when the Details tab is saved.
//
// Plenty of a job's details are not on that form and are saved from
// elsewhere entirely — the pre-inspection dates from the certificates
// tab, the site sensitivities from the job header. Writing only what the
// form produced silently wiped every one of them.
//
// So the merge goes the safe way round: the form's fields land on top of
// what is already recorded, and anything the form does not manage
// survives by default. Carrying fields across one at a time is what let
// that bug happen twice.
export function mergeJobDetails(existing: JobDetails | null | undefined, fromForm: JobDetails): JobDetails {
  const previous = existing || {};
  const merged: JobDetails = { ...previous, ...fromForm };

  // certificateDetails is one the form does rebuild, so the two fields
  // inside it that are set elsewhere have to be carried across: the
  // determination date is stamped when the certificate is issued, and the
  // consent references are no longer entered on either form.
  merged.certificateDetails = {
    ...fromForm.certificateDetails,
    determinationDate: previous.certificateDetails?.determinationDate || "",
    consentReferences: previous.certificateDetails?.consentReferences || "",
  };

  return merged;
}
