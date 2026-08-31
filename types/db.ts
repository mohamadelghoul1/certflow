import type { Pathway } from "@/lib/business";

// Hand-written types matching supabase/migrations/0001_init.sql.
// (Not auto-generated — regenerate with `supabase gen types typescript`
// once you have a live project, if you want full type safety later.)

export type Firm = {
  id: string;
  name: string;
  abn: string | null;
  postal_address: string | null;
  office_address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  // The company's Planning Portal account. Added by migration 0032.
  // Who this firm's emails come from, and where a reply lands. Blank
  // falls back to the deployment's own address — see lib/email.
  from_email?: string | null;
  reply_to_email?: string | null;
  portal_email?: string | null;
  // Automatic document chasing. Added by migration 0033.
  document_reminders_enabled?: boolean;
  document_reminder_days?: number;
  // Bank details printed on invoices. Added by migration 0035.
  payment_details?: string | null;
  // Pass the card-processing cost to clients who choose card. Added by
  // migration 0036; the code stops honouring it on 1 October 2026, when
  // Australia's surcharge ban begins.
  card_surcharge_enabled?: boolean;
  // Overdue-invoice chasing. Added by migration 0038.
  invoice_reminders_enabled?: boolean;
  invoice_reminder_days?: number;
  // The firm's own stamp artwork, placed above the drawn stamp on
  // approved documents. Null keeps the drawn stamp on its own.
  stamp_url: string | null;
  // The last placement the firm used, so a document that has never been
  // positioned starts where the previous one was put.
  stamp_x: number | null;
  stamp_y: number | null;
  stamp_scale: number | null;
};

export type Certifier = {
  id: string;
  firm_id: string;
  name: string;
  registration_no: string | null;
  registration_body: string | null;
  // Shown to clients in the portal for changing a booked inspection —
  // not the firm's office line that prints on certificates.
  mobile?: string | null;
  signature_url: string | null;
  pi_insurance_expiry: string | null;
  registration_expiry: string | null;
  user_id: string | null;
  // Where Certlyn's own notifications to this certifier go — client
  // uploads, inspection bookings. Added by migration 0040.
  email?: string | null;
  // A contract certifier's own practice, for inspections carried out by
  // someone working under their own registration rather than as an
  // employee. All optional and all added by migration 0025: blank means
  // an employee, whose reports carry the firm's letterhead.
  practice_name?: string | null;
  practice_abn?: string | null;
  practice_postal_address?: string | null;
  practice_office_address?: string | null;
  practice_phone?: string | null;
  practice_email?: string | null;
  practice_website?: string | null;
  practice_logo_url?: string | null;
  // The email this certifier signs into the NSW Planning Portal with.
  // Added by migration 0031; absent until it has been run.
  portal_email?: string | null;
};

export type ClientContact = {
  id: string;
  firm_id: string;
  name: string;
  type: "Architect" | "Builder" | "Owner" | "Other";
  company: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
};

export type Profile = {
  id: string;
  firm_id: string;
  role: "certifier" | "client";
  certifier_id: string | null;
  client_id: string | null;
  full_name: string | null;
  email: string | null;
};

export type Quote = {
  id: string;
  firm_id: string;
  // The firm's own quote number; the automatic id-derived one is used
  // when this is blank.
  quote_number: string | null;
  state: string | null;
  project_type: string | null;
  pathway: Pathway;
  required_start_date: string | null;
  required_end_date: string | null;
  valid_for: string | null;
  proposal_address: string | null;
  lot_section_plan: string | null;
  project_title: string | null;
  certifier_id: string | null;
  classifications: string[];
  development_description: string | null;
  owner_is_applicant: boolean;
  applicant: Record<string, unknown>;
  owner: Record<string, unknown>;
  council_lga: string | null;
  client_id: string | null;
  scope_of_works: string[];
  status: "draft" | "sent" | "accepted" | "declined";
  payment_status: "unpaid" | "paid";
  payment_received_date: string | null;
  terms_override: string | null;
  linked_job_id: string | null;
  created_at: string;
};

export type QuoteFeeLine = {
  id: string;
  quote_id: string;
  description: string;
  quantity: string;
  amount: number;
  sort_order: number;
};

export type Contractor = {
  id: string;
  firm_id: string;
  company: string;
  name: string;
  phone: string;
  email: string;
  licence_no: string;
};

export type Invoice = {
  id: string;
  firm_id: string;
  job_id: string | null;
  quote_id: string | null;
  client_id: string | null;
  invoice_number: string | null;
  status: "draft" | "sent" | "paid" | "void";
  issue_date: string;
  due_date: string | null;
  bill_to: string | null;
  reference: string | null;
  notes: string | null;
  // Copied from the firm at creation so an issued invoice keeps the bank
  // details it went out with. Added by migration 0035.
  payment_details?: string | null;
  stripe_payment_link_id?: string | null;
  stripe_payment_link_url?: string | null;
  // The extra the card link charges over the invoice total. Added by
  // migration 0036.
  card_surcharge?: number | null;
  // Overdue chasing (migration 0038).
  reminders_paused?: boolean;
  last_payment_reminder_at?: string | null;
  paid_date: string | null;
  created_at: string;
};

export type InvoiceLine = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: string;
  amount: number;
  sort_order: number;
};

export type JobDetails = {
  // Wording on the generated documents that this job overrides. Keyed by
  // the block being replaced ("applicantIntro", "applicantRequirements"
  // and so on) so a new editable block needs no schema change; an absent
  // key means the standard wording is used.
  docOverrides?: Record<string, string>;
  projectNumber?: string;
  zoning?: string;
  // Constraints on the land — bushfire prone, flood planning area,
  // heritage. Free text rather than a fixed set, so a constraint nobody
  // anticipated can still be recorded.
  siteSensitivities?: string[];
  bcaVersion?: string;
  bcaVolumes?: string[];
  contact?: { nameOrCompany?: string; title?: string; givenNames?: string; surname?: string; phone?: string; mobile?: string; email?: string };
  applicantAddress?: { streetNumber?: string; street?: string; suburb?: string; state?: string; postcode?: string };
  // The applicant's postal address is very often the site itself — an
  // owner building at home. Ticking this saves recording the same
  // address twice, and keeps the two in step if the site address is
  // later corrected.
  applicantSameAsSite?: boolean;
  ownerSameAsApplicant?: boolean;
  // The owner lives at the site: their address is taken from the
  // property address on every save rather than recorded separately.
  ownerAddressSameAsSite?: boolean;
  owner?: { name?: string; address?: Record<string, string>; phone?: string };
  council?: { lga?: string; address?: Record<string, string>; contact?: { phone?: string; email?: string } };
  proposal?: {
    classifications?: string[];
    constructionType?: string;
    dwellingsExisting?: string;
    dwellingsDemolished?: string;
    dwellingsNew?: string;
    estimatedCost?: string;
    storeysAbove?: string;
    storeysBelow?: string;
    storeysTotal?: string;
    effectiveHeight?: string;
    floorAreaExisting?: string;
    floorAreaNew?: string;
  };
  siteArea?: string;
  // The pre-inspection carried out before a CDC or CC is issued —
  // s139 of the EP&A Regulation 2021 for a CDC, s16 of the EP&A
  // (Development Certification and Fire Safety) Regulation 2021 for a CC.
  // Only the two dates are recorded; everything else on the report comes
  // from the job it belongs to.
  preInspection?: { applicationDate?: string; inspectionDate?: string };
  certificateDetails?: {
    lotSectionDp?: string;
    planningPortalRef?: string;
    relevantInstrument?: string;
    relevantPartOfCode?: string;
    codeParts?: string[];
    determinationDate?: string;
    lapseDate?: string;
    // CC only — a CC relies on an already-approved Development Application
    // rather than a SEPP code, so it needs its own number/date, distinct
    // from the CC's own certificate number/issuance date.
    developmentConsentNumber?: string;
    developmentConsentDate?: string;
    // Free-text, one reference per line — DA numbers, Notice of
    // Determination, or any other consent reference that doesn't fit a
    // fixed field. Shown on generated documents as its own line each.
    consentReferences?: string;
  };
  // PC_OC jobs only: the CDC or CC another certifier already issued, which
  // this firm is appointed as Principal Certifier under and issues the
  // Occupation Certificate against. Left empty on jobs that produce their
  // own certificate, where certificateDetails above holds the equivalent.
  // The Portal case inspections are reported against — often the CFT
  // series, sometimes the PCA appointment case. Recorded once so nobody
  // hunts for it at reporting time.
  inspectionPortalCase?: string;
  // The builder carrying out the works, named on the occupation
  // certificate and the one to call about a defect found on site.
  // The builder as one line — superseded by `contractor` below but kept
  // read: older jobs and imports recorded only this.
  principalContractor?: string;
  // The principal contractor in full (migration-less: lives in details).
  contractor?: { company?: string; name?: string; phone?: string; email?: string; licenceNo?: string };
  priorApproval?: {
    type?: "CDC" | "CC";
    number?: string;
    date?: string;
    // Who issued it — printed on the OC so the council can trace the
    // approval back to its author.
    issuedBy?: string;
    // The original certificate's own Planning Portal case reference —
    // the case this job's inspections are reported against.
    portalRef?: string;
  };
};

export type CriticalStageInspection = { id: string; stage: string; inspector: string; enabled: boolean };

export type Job = {
  id: string;
  firm_id: string;
  address: string;
  description: string | null;
  job_types: string[];
  pathway: Pathway;
  assigned_certifier_id: string | null;
  status: "active" | "complete";
  client_id: string | null;
  details: JobDetails;
  critical_stage_inspections: CriticalStageInspection[];
  council_letter_override: string | null;
  applicant_letter_override: string | null;
  pathway_generated: boolean;
  pathway_generated_date: string | null;
  pathway_issued_by: string | null;
  pathway_signed_at: string | null;
  pathway_sent_to_client: boolean;
  pathway_sent_to_client_date: string | null;
  pathway_version: number;
  pathway_approval_uploaded: boolean;
  pathway_approval_date: string | null;
  pathway_approval_file_path: string | null;
  pathway_portal_reported: boolean;
  pathway_portal_reported_date: string | null;
  // Automatic document chasing (migration 0033). Optional because a
  // database still awaiting the migration simply has no columns to read.
  document_reminders_paused?: boolean;
  last_document_reminder_at?: string | null;
  created_at: string;
};

export type Checklist = {
  id: string;
  job_id: string;
  kind: "pathway" | "noc" | "oc" | "modification";
  modification_id: string | null;
};

export type ChecklistItem = {
  id: string;
  checklist_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: "requested" | "submitted" | "approved";
  version: number;
  revision: string | null;
  document_date: string | null;
  prepared_by: string | null;
  drawing_number: string | null;
  clause_ref: string | null;
  requires_stamping: boolean;
  file_path: string | null;
  sort_order: number;
  // Kept off the client portal entirely — a peer review, a fee to
  // collect, a note to chase council. Hidden by row security rather than
  // by filtering, so nothing can leak one by forgetting. Added by
  // migration 0051; absent until it has been run.
  internal?: boolean;
  // Where the approval stamp sits on this document, as a fraction of the
  // page from its top-left, and how big it is. Null means the
  // bottom-right corner at normal size. See migration 0015.
  stamp_x: number | null;
  stamp_y: number | null;
  stamp_scale: number | null;
  // Whether this document belongs in the generated approval — the full
  // approved set PDF and the certificate's Schedule 1. The signed
  // certification contract is the usual thing to leave out: it has to be
  // collected and kept, but it isn't part of what goes to a builder or a
  // council. See migration 0020.
  include_in_approval: boolean;
  // The library item this was requested from, when it came from the firm's
  // document library. Only used to find the blank form to hand the client:
  // the file lives on the library row, so replacing it under Settings
  // updates every project at once. See migration 0019.
  template_library_item_id: string | null;
};

export type DocumentLibraryItem = {
  id: string;
  firm_id: string;
  pathway: string;
  title: string;
  description: string | null;
  category: string | null;
  sort_order: number;
  // The firm's own blank form for this item — the contract, an application
  // form — for the client to download, complete and upload back.
  template_file_path: string | null;
  template_file_name: string | null;
};

// One row per upload against a checklist document — the file the client
// (or the certifier on their behalf) sent, kept even after a newer one
// replaces it. checklist_items.file_path still points at the current
// version; this is the trail behind it. See migration 0021.
export type ChecklistItemFile = {
  id: string;
  checklist_item_id: string;
  file_path: string;
  version: number;
  uploaded_by_role: "client" | "certifier";
  uploaded_by: string | null;
  created_at: string;
  // All added by migration 0023, and absent until it has been run: which
  // document on the item this is, whether it is that document's latest
  // version, and the Schedule 1 details belonging to it.
  document_no?: number;
  is_current?: boolean;
  label?: string | null;
  prepared_by?: string | null;
  drawing_number?: string | null;
  revision?: string | null;
  document_date?: string | null;
};

export type Amendment = {
  id: string;
  checklist_item_id: string;
  text: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
};

export type Modification = {
  id: string;
  job_id: string;
  reason: string | null;
  // The modification's own NSW Planning Portal reference and
  // pre-inspection dates — a modification is its own Portal application
  // with its own s139/s16 inspection, distinct from the original
  // certificate's. Undefined until migration 0065 has been run.
  portal_ref?: string | null;
  pre_application_date?: string | null;
  pre_inspection_date?: string | null;
  generated: boolean;
  generated_date: string | null;
  issued_by: string | null;
  version: number;
  approval_uploaded: boolean;
  approval_date: string | null;
  approval_file_path: string | null;
};

export type PathwayCertificateVersion = {
  cert_ref: string | null;
  id: string;
  job_id: string;
  version: number;
  generated_date: string;
  issued_by: string | null;
  signed_at: string | null;
  sent_to_client: boolean;
  sent_to_client_date: string | null;
  approval_uploaded: boolean;
  approval_date: string | null;
  approval_file_path: string | null;
  visible_to_client: boolean;
  created_at: string;
};

export type OcRecord = {
  cert_ref: string | null;
  // The NSW Planning Portal reference this certificate was lodged under
  // (the CFT series). Per certificate, not per job — see migration 0016.
  portal_ref: string | null;
  id: string;
  job_id: string;
  type: "partial" | "whole";
  description: string | null;
  generated_date: string | null;
  issued_by: string | null;
  signed_at: string | null;
  sent_to_client: boolean;
  sent_to_client_date: string | null;
  approval_uploaded: boolean;
  approval_date: string | null;
  approval_file_path: string | null;
  portal_reported: boolean;
  portal_reported_date: string | null;
  created_at: string;
};

export type Inspection = {
  id: string;
  job_id: string;
  title: string;
  description: string | null;
  date: string | null;
  outcome: "pending" | "passed" | "failed" | "passed_subject_to";
  inspector_certifier_id: string | null;
  report_sent: boolean;
  report_sent_date: string | null;
  report_file_path: string | null;
  report_signed_at: string | null;
  // The signed report, built once when it is signed rather than on every
  // download. Added by migration 0027; cleared when the report is reopened.
  report_pdf_path?: string | null;
  report_intro_override: string | null;
  report_notes: string | null;
  booked_by_client: boolean;
  confirmed: boolean;
  portal_reported: boolean;
  portal_reported_date: string | null;
  // The Portal's own case number for an inspection sent through the API.
  // Added by migration 0030; absent until it has been run.
  portal_child_case_id?: string | null;
  // Added by migration 0022; absent until it has been run.
  sort_order?: number;
};

export type Defect = {
  id: string;
  inspection_id: string;
  text: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
};

export type InspectionPhoto = {
  id: string;
  inspection_id: string;
  file_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

export type ConditionOfConsent = {
  id: string;
  job_id: string;
  text: string;
  date_added: string;
};

export type TaskList = {
  id: string;
  firm_id: string;
  title: string;
  sort_order: number;
  created_at: string;
};

export type ManualTask = {
  id: string;
  list_id: string;
  text: string;
  note: string | null;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
};
