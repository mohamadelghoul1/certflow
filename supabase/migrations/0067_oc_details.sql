-- The Occupation Certificate names what it does not cover.
--
-- A partial OC exists precisely because something is unfinished — a
-- swimming pool still being built, landscaping still to go in — and the
-- certificate must say so in its own Exclusions row, in the certifier's
-- words for this job. One column on the record, typed when the OC is
-- issued.

alter table oc_records add column if not exists exclusions text;
