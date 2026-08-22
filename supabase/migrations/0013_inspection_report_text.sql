-- Editable wording for the generated inspection report.
--
-- Most of a report is structured data pulled from the job and the
-- inspection itself, but two parts are genuinely prose and previously
-- couldn't be changed without exporting to Word and editing there:
--
--   report_intro_override — replaces the standard "We have attended the
--     above property..." paragraph under INSPECTION RESULTS. Null keeps the
--     standard wording, so existing reports are untouched.
--
--   report_notes — an optional free-text section for observations that
--     don't fit the results table or the required-documents list. Omitted
--     from the report entirely when blank, rather than printing an empty
--     heading.
alter table inspections add column if not exists report_intro_override text;
alter table inspections add column if not exists report_notes text;
