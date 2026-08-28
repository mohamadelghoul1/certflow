-- Where the signatures land on the agreement, and the finished signed
-- copy once they have.
--
-- A firm's agreement has its own execution block — "Signature of
-- Owner/s" in a table on a particular page — so the certifier says once
-- where that is, and every signature on that agreement is drawn into it.
-- Position is held as a fraction of the page, not in points, so it holds
-- whatever size the page turns out to be.
alter table engagement_agreements add column if not exists signature_page integer;
alter table engagement_agreements add column if not exists signature_x real;
alter table engagement_agreements add column if not exists signature_y real;
alter table engagement_agreements add column if not exists signature_width real;

-- The original with every signature merged into it, plus the record of
-- who signed and when. Written once the last signature lands.
alter table engagement_agreements add column if not exists signed_file_path text;
