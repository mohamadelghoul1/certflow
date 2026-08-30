-- The firm folder in a storage path has to be the job's own firm.
--
-- Every file lives at <firm>/<job>/... and the client policies only ever
-- checked the second segment: is this a job you can see? The first was
-- taken on trust — and it is chosen in the browser, where a client can
-- edit it before the upload goes.
--
-- So a client could put their own document under another firm's folder.
-- Three things follow from that, none of them good:
--
--   * The certifier policy admits a file by its first segment, so the
--     other firm's certifier could then read it.
--   * Deleting a project removes <that firm>/<job>, so a file filed
--     under a different firm survives the purge with nothing pointing
--     at it.
--   * Storage usage is counted by folder, so it lands on the wrong
--     firm's total.
--
-- Reading and writing were never wrong about the job — a client still
-- cannot touch a job that is not theirs, and that was tested. This is
-- about the folder being what it says it is.
--
-- Safe to run twice.

drop policy if exists "client upload own job storage" on storage.objects;
create policy "client upload own job storage" on storage.objects for insert
  with check (
    bucket_id = 'certflow-files'
    and current_app_role() = 'client'
    and job_visible_to_client(((storage.foldername(name))[2])::uuid)
    and exists (
      select 1 from jobs j
      where j.id = ((storage.foldername(name))[2])::uuid
        and j.firm_id = ((storage.foldername(name))[1])::uuid
    )
  );

drop policy if exists "client read own job storage" on storage.objects;
create policy "client read own job storage" on storage.objects for select
  using (
    bucket_id = 'certflow-files'
    and current_app_role() = 'client'
    and job_visible_to_client(((storage.foldername(name))[2])::uuid)
    and exists (
      select 1 from jobs j
      where j.id = ((storage.foldername(name))[2])::uuid
        and j.firm_id = ((storage.foldername(name))[1])::uuid
    )
  );

-- A marker, so Settings can tell whether this has been run: the policies
-- themselves cannot be read back through the API.
create or replace function storage_firm_folder_enforced()
returns boolean language sql immutable as $$ select true $$;
grant execute on function storage_firm_folder_enforced() to authenticated;
