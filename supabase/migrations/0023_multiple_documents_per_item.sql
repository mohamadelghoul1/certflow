-- More than one document against a single checklist item.
--
-- A checklist item has always held exactly one file: uploading again
-- replaced what was there, and migration 0021 kept the earlier files as
-- version history behind it. But some items are genuinely satisfied by
-- two documents — two structural certificates for one certification, a
-- report and its addendum — and both belong in the approval.
--
-- So checklist_item_files stops being only a history of one file and
-- becomes the list of documents on the item. Each row is one upload;
-- document_no says which document on the item it is, and is_current says
-- whether it is that document's latest version. The item's own file_path
-- still points at the first document's current file, so everything that
-- reads a single file today is untouched.
--
-- Each document carries its own Schedule 1 details, because two
-- certificates rarely share a preparer, a reference or a date, and a
-- Schedule that lists them under one row is inaccurate.

alter table checklist_item_files
  add column if not exists document_no int not null default 1,
  add column if not exists is_current boolean not null default true,
  add column if not exists label text,
  add column if not exists prepared_by text,
  add column if not exists drawing_number text,
  add column if not exists revision text,
  add column if not exists document_date date;

-- Everything uploaded so far is the item's first (and only) document, and
-- the highest version of it is the one currently in force.
with ranked as (
  select id,
         checklist_item_id,
         row_number() over (partition by checklist_item_id order by version desc, created_at desc) as recency
  from checklist_item_files
)
update checklist_item_files f
set document_no = 1,
    is_current = (ranked.recency = 1)
from ranked
where ranked.id = f.id;

-- The details the item already carries belong to that first document, so
-- Schedule 1 keeps listing exactly what it lists today.
update checklist_item_files f
set prepared_by = coalesce(f.prepared_by, i.prepared_by),
    drawing_number = coalesce(f.drawing_number, i.drawing_number),
    revision = coalesce(f.revision, i.revision),
    document_date = coalesce(f.document_date, i.document_date)
from checklist_items i
where i.id = f.checklist_item_id
  and f.document_no = 1;

create index if not exists checklist_item_files_current_idx on checklist_item_files(checklist_item_id, document_no, is_current);

-- The client's upload path now says which document it is replacing.
-- Passing no document number adds a new one, which is how a client sends
-- a second certificate rather than overwriting the first.
drop function if exists client_submit_document(uuid, text);
drop function if exists client_submit_document(uuid, text, int);

create function client_submit_document(p_item_id uuid, p_file_path text, p_document_no int default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_version int;
  v_document_no int;
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

  -- A replacement for a document that is already there, or the next
  -- document along.
  if p_document_no is null then
    select coalesce(max(document_no), 0) + 1 into v_document_no from checklist_item_files where checklist_item_id = p_item_id;
  else
    v_document_no := p_document_no;
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from checklist_item_files
  where checklist_item_id = p_item_id and document_no = v_document_no;

  -- Only the newest upload of this document is in force; the ones before
  -- it stay as its history.
  update checklist_item_files
  set is_current = false
  where checklist_item_id = p_item_id and document_no = v_document_no;

  insert into checklist_item_files (checklist_item_id, file_path, version, document_no, is_current, uploaded_by_role, uploaded_by)
  values (p_item_id, p_file_path, v_version, v_document_no, true, 'client', auth.uid());

  -- The item's own pointer follows the first document, which is what
  -- every screen showing "the" file for an item reads.
  update checklist_items
  set file_path = case when v_document_no = 1 then p_file_path else file_path end,
      status = 'submitted',
      version = version + 1,
      updated_at = now()
  where id = p_item_id;
end;
$$;

grant execute on function client_submit_document(uuid, text, int) to authenticated;
