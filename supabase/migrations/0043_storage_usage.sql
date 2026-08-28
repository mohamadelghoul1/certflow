-- What each project is holding in storage.
--
-- Asking Storage file by file would be thousands of round trips for a
-- firm with any history. Every object's path starts {firm}/{job}/, so
-- one grouped query over the storage catalogue answers it: bytes and
-- file count per project, for the caller's own firm only.
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
    group by 1;
end;
$$;

grant execute on function firm_storage_usage() to authenticated;
