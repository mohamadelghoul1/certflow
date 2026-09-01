import type { FieldKey } from "@/lib/certificates/templateFields";

// Where a correction typed on the certificate screen is stored.
//
// Every row is editable in place, and what is typed has to reach the
// PDF and the Word export. Nine rows were once saved under a name of
// their own that no document read, so the correction went nowhere. Both
// ends read this list now: the screen writes the first name, and the
// documents accept any of them, which is what keeps corrections already
// typed on live jobs working.
//
// A CDC screen saved the council under one name and a CC under another.
// A job is one pathway, so either is that row.
export const DOC_KEYS: Record<FieldKey, string[]> = {
  applicant: ["cert.applicant"],
  applicantAddress: ["cert.applicantAddress"],
  applicantPhone: ["cert.applicantPhone"],
  owner: ["cert.owner"],
  ownerAddress: ["cert.ownerAddress"],
  ownerPhone: ["cert.ownerPhone"],
  planningPortalRef: ["cert.portalRef", "cert.planningPortalRef"],
  lga: ["cert.lga", "cert.consentAuthority"],
  epi: ["cert.epi"],
  partOfCode: ["cert.partOfCode"],
  determinationDate: ["cert.determination", "cert.determinationDate"],
  lapseDate: ["cert.lapse", "cert.lapseDate"],
  developmentConsentNumber: ["cert.consentNumber", "cert.developmentConsentNumber"],
  developmentConsentDate: ["cert.consentDate", "cert.developmentConsentDate"],
  certificateNumber: ["cert.ccNumber", "cert.certificateNumber"],
  issuedDate: ["cert.ccIssueDate", "cert.issuedDate"],
  devAddress: ["cert.devAddress"],
  lotDp: ["cert.lotDp"],
  zone: ["cert.zone"],
  bcaClass: ["cert.bcaClass"],
  bcaVersion: ["cert.bcaVersion"],
  description: ["cert.description"],
  value: ["cert.value"],
  attachments: ["cert.attachments"],
  conditions: ["cert.conditions"],
  inspections: ["cert.inspections"],
  certifierName: ["cert.certifierName"],
  registrationBody: ["cert.registrationBody"],
  registrationNo: ["cert.registrationNo"],
  consentRelied: ["cert.consentRelied"],
  daNumber: ["cert.daNumber"],
  daDate: ["cert.daDate"],
  ocType: ["cert.ocType"],
  exclusions: ["cert.exclusions"],
};

// The name the screen writes under.
export function writeKey(field: FieldKey): string {
  return DOC_KEYS[field][0];
}
