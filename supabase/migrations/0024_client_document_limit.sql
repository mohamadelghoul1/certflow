-- How many documents a client can put against one checklist item.
--
-- An item can hold several documents (migration 0023), which is right for
-- the certifier assembling an approval. Left open to the client it is an
-- invitation to send the same certificate three times as three documents
-- rather than as new versions of one, and the approval then carries all
-- three. Two covers the real case — a certificate and its companion —
-- and anything further is a conversation with the certifier.
--
-- Replacing a document a client already sent is always allowed, however
-- many versions that takes. Only adding a further document is capped.

create or replace function client_submit_document(p_item_id uuid, p_file_path text, p_document_no int default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_version int;
  v_document_no int;
  v_existing int;
  v_limit constant int := 2;
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

  select count(distinct document_no) into v_existing from checklist_item_files where checklist_item_id = p_item_id;

  -- A replacement for a document that is already there, or the next
  -- document along.
  if p_document_no is null then
    if v_existing >= v_limit then
      raise exception 'You can upload up to % documents for this item. Upload a new version of one you have already sent, or ask your certifier if another document is needed.', v_limit;
    end if;
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
