-- Lets a certifier override the auto-generated certificate reference.
--
-- References are normally built as {PATHWAY}-{project number}/{version},
-- e.g. CDC-25014/01, which suits most jobs. This column holds a
-- replacement typed by the certifier for the cases it doesn't — a
-- reference carried over from another system, a council-mandated format,
-- or a correction after the fact.
--
-- Nullable and empty by default: every existing certificate keeps its
-- current auto-generated reference, and the app falls back to generating
-- one whenever this is null or blank. Stored per version / per OC record
-- rather than per job, so re-issuing doesn't inherit the previous
-- version's reference by accident.
alter table pathway_certificate_versions add column cert_ref text;
alter table oc_records add column cert_ref text;
