-- Adds an explicit "signed" step to the documents CertFlow generates
-- (CDC/CC certificate package, Occupation Certificate, inspection reports).
-- Previously the certifier's signature image was inserted automatically the
-- moment a document was generated/issued, with no way to review the Word
-- export first and only add the signature once happy with it. Generating
-- now always renders a blank signature line until this signed_at is set by
-- pressing "Sign" on the document itself.

alter table pathway_certificate_versions add column if not exists signed_at timestamptz;
alter table jobs add column if not exists pathway_signed_at timestamptz;

alter table oc_records add column if not exists signed_at timestamptz;

alter table inspections add column if not exists report_signed_at timestamptz;
