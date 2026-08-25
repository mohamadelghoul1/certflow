-- A contract certifier's own practice details.
--
-- Inspections are often carried out by a registered certifier working as
-- a contractor rather than an employee — their own company, their own
-- ABN, their own registration. Their inspection report should go out on
-- their letterhead, naming them, because they are who attended.
--
-- All optional. A certifier who leaves these blank is an employee of the
-- firm and their reports carry the firm's letterhead exactly as before,
-- which is every certifier that exists today.
--
-- Only the inspection report follows these. A certificate, a covering
-- letter and a pre-inspection report are the firm's own documents and
-- stay on the firm's letterhead whoever is named on them.

alter table certifiers
  add column if not exists practice_name text,
  add column if not exists practice_abn text,
  add column if not exists practice_postal_address text,
  add column if not exists practice_office_address text,
  add column if not exists practice_phone text,
  add column if not exists practice_email text,
  add column if not exists practice_website text,
  add column if not exists practice_logo_url text;
