-- A third kind of engagement: Principal Certifier appointment and
-- Occupation Certificate only.
--
-- Some clients arrive with a CDC or CC already issued by another
-- certifier and want us only as the Principal Certifier — carrying out
-- the mandatory inspections and issuing the Occupation Certificate. That
-- job never produces a CDC or CC of its own, so the certificate it
-- relies on is recorded as details of a previously issued approval
-- instead (type, number and date, inside jobs.details), and the OC
-- documents name that approval rather than one of ours.
--
-- The existing two values are unchanged, so every current job and quote
-- keeps working exactly as it does today.

alter table jobs drop constraint if exists jobs_pathway_check;
alter table jobs add constraint jobs_pathway_check
  check (pathway in ('CDC', 'CC', 'PC_OC'));

alter table quotes drop constraint if exists quotes_pathway_check;
alter table quotes add constraint quotes_pathway_check
  check (pathway in ('CDC', 'CC', 'PC_OC'));
