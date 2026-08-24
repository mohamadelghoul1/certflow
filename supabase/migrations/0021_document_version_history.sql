-- Every version of a document, not just the latest.
--
-- checklist_items holds one file_path, overwritten on each upload, so a
-- client who sent architectural plans three times left the certifier able
-- to open only the third. The earlier files were never deleted — each
-- upload is stored under its own timestamped path — but nothing linked to
-- them, so the set a certificate was assessed against couldn't be shown
-- afterwards.
--
-- One row per upload fixes that. checklist_items.file_path stays as it is
-- and keeps pointing at the current version, so everything that reads a
-- document today is untouched.

create table if not exists checklist_item_files (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  file_path text not null,
  -- 1 for the first upload against an item, counting up.
  version int not null,
  -- Who sent it: the client through their portal, or the certifier
  -- uploading on their behalf. Worth recording — "the applicant supplied
  -- this" and "we scanned this in for them" are different facts.
  uploaded_by_role text not null check (uploaded_by_role in ('client', 'certifier')),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists checklist_item_files_item_idx on checklist_item_files(checklist_item_id, version);

alter table checklist_item_files enable row level security;

-- Same visibility as the document it belongs to: a certifier sees their
-- own firm's, a client sees their own jobs'. Neither writes directly —
-- uploads go through client_submit_document or the certifier's server
-- action, both of which insert the history row themselves.
drop policy if exists "certifier read checklist_item_files" on checklist_item_files;
drop policy if exists "client read checklist_item_files" on checklist_item_files;
drop policy if exists "certifier write checklist_item_files" on checklist_item_files;

create policy "certifier read checklist_item_files" on checklist_item_files for select
  using (
    current_app_role() = 'certifier'
    and exists (
      select 1 from checklist_items i
      join checklists c on c.id = i.checklist_id
      join jobs j on j.id = c.job_id
      where i.id = checklist_item_id and j.firm_id = current_firm_id()
    )
  );

create policy "client read checklist_item_files" on checklist_item_files for select
  using (
    current_app_role() = 'client'
    and exists (
      select 1 from checklist_items i
      join checklists c on c.id = i.checklist_id
      where i.id = checklist_item_id and job_visible_to_client(c.job_id)
    )
  );

create policy "certifier write checklist_item_files" on checklist_item_files for insert
  with check (
    current_app_role() = 'certifier'
    and exists (
      select 1 from checklist_items i
      join checklists c on c.id = i.checklist_id
      join jobs j on j.id = c.job_id
      where i.id = checklist_item_id and j.firm_id = current_firm_id()
    )
  );

-- Everything already uploaded becomes the first entry in its own history,
-- so no document a firm holds today goes missing from the new list. The
-- item's version counter is what the app has been showing, so it is kept
-- as the version number rather than inventing a new one.
insert into checklist_item_files (checklist_item_id, file_path, version, uploaded_by_role, created_at)
select i.id, i.file_path, greatest(i.version, 1), 'client', i.updated_at
from checklist_items i
where i.file_path is not null
  and not exists (select 1 from checklist_item_files f where f.checklist_item_id = i.id);

-- The client's upload path records the version alongside the file, so the
-- history and the item can never disagree about which one is current.
create or replace function client_submit_document(p_item_id uuid, p_file_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_version int;
begin
  if current_app_role() <> 'client' then
    raise exception 'not a client user';
  end if;

  select c.job_id into v_job_id
  from checklist_items i join checklists c on c.id = i.checklist_id
  where i.id = p_item_id;

  if v_job_id is null or not job_visible_to_client(v_job_id) then
    raise exception 'item not found or not accessible';
  end if;

  update checklist_items
  set file_path = p_file_path,
      status = 'submitted',
      version = version + 1,
      updated_at = now()
  where id = p_item_id
  returning version into v_version;

  insert into checklist_item_files (checklist_item_id, file_path, version, uploaded_by_role, uploaded_by)
  values (p_item_id, p_file_path, v_version, 'client', auth.uid());
end;
$$;

grant execute on function client_submit_document(uuid, text) to authenticated;
