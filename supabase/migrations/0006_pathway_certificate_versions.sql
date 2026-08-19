-- Every time a certifier issues/regenerates the original CDC/CC, that used
-- to overwrite the single set of pathway_* columns on jobs — so an earlier
-- signed approval was lost the moment a new version was generated, with no
-- way to see it again, choose which one the client sees, or undo a mistaken
-- regeneration. This table keeps every version as its own row instead.
--
-- jobs.pathway_* columns are kept as a cache of whichever version has
-- visible_to_client = true, so the certificate document page, client
-- portal, dashboard tasks, and reports/audit pages (which all read those
-- columns directly) keep working unchanged.

create table pathway_certificate_versions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  version int not null,
  generated_date date not null,
  issued_by uuid references certifiers(id) on delete set null,
  approval_uploaded boolean not null default false,
  approval_date date,
  approval_file_path text,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now()
);
create index on pathway_certificate_versions(job_id);

alter table pathway_certificate_versions enable row level security;

create policy "certifier crud pathway_certificate_versions" on pathway_certificate_versions for all
  using (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');
create policy "client read visible pathway_certificate_versions" on pathway_certificate_versions for select
  using (current_app_role() = 'client' and visible_to_client = true and job_visible_to_client(job_id));

-- Back-fill: every job that already has a certificate issued gets its
-- existing single version turned into row #1, so nothing already issued
-- disappears from the new version list.
insert into pathway_certificate_versions (job_id, version, generated_date, issued_by, approval_uploaded, approval_date, approval_file_path, visible_to_client)
select id, greatest(pathway_version, 1), coalesce(pathway_generated_date, current_date), pathway_issued_by, pathway_approval_uploaded, pathway_approval_date, pathway_approval_file_path, true
from jobs
where pathway_generated = true;
