-- Count files, not folder markers.
--
-- Supabase writes a zero-byte row called ".emptyFolderPlaceholder" to
-- keep an empty folder visible in its file browser. It is a marker, not
-- a document, and counting it inflated the file count on the Storage
-- page — "23 files" for a project holding twenty.
--
-- It never affected the size, because a marker is zero bytes. Rows with
-- no recorded size are skipped for the same reason: they contribute
-- nothing to a total and are not something a certifier uploaded.
--
-- Safe to run twice.

create or replace function firm_storage_usage()
returns table (job_id text, bytes bigint, files bigint)
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if current_app_role() <> 'certifier' then
    raise exception 'not a certifier';
  end if;

  return query
    select split_part(o.name, '/', 2) as job_id,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint as bytes,
           count(*)::bigint as files
    from storage.objects o
    where o.bucket_id = 'certflow-files'
      and split_part(o.name, '/', 1) = current_firm_id()::text
      and split_part(o.name, '/', 2) <> ''
      and o.name not like '%.emptyFolderPlaceholder'
    group by 1
    -- A folder that holds nothing but a marker is not a project with
    -- files in it, so it drops off the report entirely.
    having count(*) > 0;
end;
$$;

grant execute on function firm_storage_usage() to authenticated;
