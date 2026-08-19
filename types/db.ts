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
};

export type Certifier = {
  id: string;
  firm_id: string;
  name: string;
  registration_no: string | null;
  registration_body: string | null;
  signature_url: string | null;
  pi_insurance_expiry: string | null;
  registration_expiry: string | null;
  user_id: string | null;
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
  state: string | null;
  project_type: string | null;
  pathway: "CDC" | "CC";
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

export type JobDetails = {
  projectNumber?: string;
  zoning?: string;
  bcaVersion?: string;
  contact?: { nameOrCompany?: string; title?: string; givenNames?: string; surname?: string; phone?: string; fax?: string; mobile?: string; email?: string };
  applicantAddress?: { streetNumber?: string; street?: string; suburb?: string; state?: string; postcode?: string };
  ownerSameAsApplicant?: boolean;
  owner?: { name?: string; address?: Record<string, string>; phone?: string };
  council?: { lga?: string; address?: Record<string, string>; contact?: { phone?: string; fax?: string; email?: string } };
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
  buildingDescription?: string;
  certificateDetails?: {
    lotSectionDp?: string;
    planningPortalRef?: string;
    relevantInstrument?: string;
    relevantPartOfCode?: string;
    codeParts?: string[];
    determinationDate?: string;
    lapseDate?: string;
  };
};

export type Job = {
  id: string;
  firm_id: string;
  address: string;
  description: string | null;
  job_types: string[];
  pathway: "CDC" | "CC";
  assigned_certifier_id: string | null;
  status: "active" | "complete";
  client_id: string | null;
  details: JobDetails;
  critical_stage_inspections: number[];
  council_letter_override: string | null;
  applicant_letter_override: string | null;
  pathway_generated: boolean;
  pathway_generated_date: string | null;
  pathway_issued_by: string | null;
  pathway_version: number;
  pathway_approval_uploaded: boolean;
  pathway_approval_date: string | null;
  pathway_approval_file_path: string | null;
  pathway_portal_reported: boolean;
  pathway_portal_reported_date: string | null;
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
  generated: boolean;
  generated_date: string | null;
  issued_by: string | null;
  version: number;
  approval_uploaded: boolean;
  approval_date: string | null;
  approval_file_path: string | null;
};

export type OcRecord = {
  id: string;
  job_id: string;
  type: "partial" | "whole";
  description: string | null;
  generated_date: string | null;
  issued_by: string | null;
  approval_uploaded: boolean;
  approval_date: string | null;
  approval_file_path: string | null;
  portal_reported: boolean;
  portal_reported_date: string | null;
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
  booked_by_client: boolean;
  confirmed: boolean;
  portal_reported: boolean;
  portal_reported_date: string | null;
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
