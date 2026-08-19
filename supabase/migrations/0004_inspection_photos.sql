-- Photographic evidence attached to an inspection (Build Brief: inspection
-- reports can include photos with captions). Files themselves live in the
-- existing "certflow-files" storage bucket, same RLS pattern as everything
-- else — this table just tracks the path + caption per photo.

create table inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  file_path text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on inspection_photos(inspection_id);

alter table inspection_photos enable row level security;

create policy "certifier crud inspection_photos" on inspection_photos for all
  using (exists (select 1 from inspections i join jobs j on j.id = i.job_id where i.id = inspection_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from inspections i join jobs j on j.id = i.job_id where i.id = inspection_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');
create policy "client read inspection_photos" on inspection_photos for select
  using (current_app_role() = 'client' and exists (select 1 from inspections i where i.id = inspection_id and job_visible_to_client(i.job_id)));
