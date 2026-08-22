-- Build Brief §9: certifiers must report CDC/CC/OC issuance and critical
-- stage inspections to the NSW Planning Portal within 2 business days of
-- each event. inspections.portal_reported/portal_reported_date already
-- exist (migration 0001) — this adds the same acknowledgement tracking for
-- the other two reportable events: the original CDC/CC and each OC.
--
-- There's no live Planning Portal API access from this environment (it
-- requires a subscription key obtained directly from the Planning Portal
-- team — see the build brief), so this is a manual "I've reported this"
-- acknowledgement plus a dashboard deadline task, not an automated
-- submission. Wire up the real Common API calls once that key exists.

alter table jobs add column if not exists pathway_portal_reported boolean not null default false;
alter table jobs add column if not exists pathway_portal_reported_date date;

alter table oc_records add column if not exists portal_reported boolean not null default false;
alter table oc_records add column if not exists portal_reported_date date;
