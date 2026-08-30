-- What a client may put into the portal.
--
-- A client's file goes straight from their browser to storage: the
-- server never sees the bytes, so a check written in the app is advice
-- to the honest and nothing at all to anyone willing to edit a script.
-- The database is the only place this can actually be enforced.
--
-- A certifier is sent drawings, certificates and photographs. They are
-- never sent a program, so the shapes that are only ever an attack —
-- .exe, .bat, .js, .scr, and archives that hide them — are refused at
-- the point of upload rather than discovered on someone's desk.
--
-- This is a list of what is allowed, not a list of what is banned. A
-- banned list is a promise to think of everything, and it only has to be
-- wrong once.
--
-- Note what this is not: it is not virus scanning. A PDF can be
-- malicious and still be a PDF. This refuses the obvious, and the
-- certifier's own antivirus remains what stands between a bad document
-- and their computer.
--
-- Certifier uploads are deliberately left alone. They are the trusted
-- party here, they upload their own letterheads and signatures, and a
-- list that has not been tested against every one of their workflows is
-- more likely to block real work than to prevent an attack.
--
-- Safe to run twice.

create or replace function allowed_upload_name(p_name text)
returns boolean
language sql
immutable
as $$
  select lower(regexp_replace(p_name, '^.*\.', '')) in (
    'pdf','doc','docx','xls','xlsx',
    'jpg','jpeg','png','heic','heif','webp',
    'dwg','dxf'
  )
  -- A name with no dot at all has no extension to check, and nothing a
  -- client legitimately sends arrives without one.
  and p_name like '%.%';
$$;

grant execute on function allowed_upload_name(text) to authenticated;

drop policy if exists "client upload own job storage" on storage.objects;
create policy "client upload own job storage" on storage.objects for insert
  with check (
    bucket_id = 'certflow-files'
    and current_app_role() = 'client'
    and job_visible_to_client(((storage.foldername(name))[2])::uuid)
    -- The folder is the job's own firm — migration 0061.
    and exists (
      select 1 from jobs j
      where j.id = ((storage.foldername(name))[2])::uuid
        and j.firm_id = ((storage.foldername(name))[1])::uuid
    )
    and allowed_upload_name(name)
  );

-- Storage enforces this itself, whoever is uploading and whatever the
-- app forgot to check. Generous on purpose: an architectural set is
-- large, and a client who has to split a drawing will email it instead.
--
-- Guarded because the column belongs to Supabase's own storage schema
-- rather than to this app: a platform without it should leave the rest
-- of this migration applied rather than failing the lot.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit'
  ) then
    update storage.buckets set file_size_limit = 52428800 where id = 'certflow-files';
  else
    raise notice 'storage.buckets has no file_size_limit column here; the size cap was not set.';
  end if;
end $$;
