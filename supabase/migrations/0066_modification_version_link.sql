-- Which certificate version a modification produced.
--
-- Without this the modification card could only show "whichever version
-- is currently active" — and on a job where the modification had not
-- created its own version, that was the ORIGINAL certificate, wearing a
-- "Modified certificate" label and a Delete button. Pressing it deleted
-- the original CDC. The link makes the card show, and delete, only the
-- version the modification itself produced.
--
-- on delete set null: deleting the version leaves the modification in
-- place (it goes back to draft in the application code) rather than
-- refusing the delete or taking the modification with it.
alter table public.modifications
  add column if not exists certificate_version_id uuid references public.pathway_certificate_versions(id) on delete set null;
