-- Each modification is its own NSW Planning Portal application, with its
-- own reference number and its own pre-inspection (s139 for a CDC, s16
-- for a CC) carried out before the modified certificate is issued.
--
-- These lived only on the job before, which meant a modification quietly
-- reused — and overwrote — the original certificate's Portal reference
-- and inspection dates. Now the original keeps its own and every
-- modification records its own.
alter table public.modifications add column if not exists portal_ref text;
alter table public.modifications add column if not exists pre_application_date date;
alter table public.modifications add column if not exists pre_inspection_date date;
