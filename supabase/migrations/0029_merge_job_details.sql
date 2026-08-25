-- Saving one field on a job without overwriting the rest.
--
-- A job's details are a single jsonb column, and several different parts
-- of the app write into it: the Details tab, the site sensitivities on
-- the job header, the Planning Portal reference and the pre-inspection
-- dates on the certificates tab, and the determination date stamped when
-- a certificate is issued.
--
-- Every one of them worked the same way: read the whole record, change
-- the part it owns, write the whole record back. Two of those happening
-- close together and the second one writes over the first, because it
-- was working from a copy taken before the first had landed. The window
-- is small, but a certifier ticking "bushfire" and pressing Save details
-- a moment later is not an unusual thing to do, and losing the tick
-- leaves no sign that anything went wrong.
--
-- So the merge happens here instead, inside the single statement that
-- does the update. There is nothing to read first and nothing to race.

-- Merges b over a, one key at a time and all the way down, so a patch
-- naming one field inside certificateDetails leaves the rest of
-- certificateDetails alone.
--
-- Two rules worth stating plainly:
--   * A json null in the patch removes that key. That is how the Details
--     form drops a prior approval when a job stops being PC/OC — leaving
--     it out of the patch would mean "don't touch it", which is the
--     opposite of what is wanted.
--   * An array is replaced whole, never merged. Site sensitivities and
--     BCA volumes are lists the user has just chosen; appending to them
--     would make unticking impossible.
create or replace function jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb;
  k text;
  v jsonb;
begin
  if b is null or jsonb_typeof(b) <> 'object' then
    return b;
  end if;
  if a is null or jsonb_typeof(a) <> 'object' then
    result := '{}'::jsonb;
  else
    result := a;
  end if;

  for k, v in select key, value from jsonb_each(b) loop
    if jsonb_typeof(v) = 'null' then
      result := result - k;
    elsif jsonb_typeof(v) = 'object' and jsonb_typeof(coalesce(result -> k, 'null'::jsonb)) = 'object' then
      result := jsonb_set(result, array[k], jsonb_deep_merge(result -> k, v));
    else
      result := jsonb_set(result, array[k], v, true);
    end if;
  end loop;

  return result;
end;
$$;

-- Security invoker on purpose: this must be exactly as restricted as an
-- ordinary update, so the firm's own row level security decides who may
-- write to which job, not this function.
create or replace function merge_job_details(p_job_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_details jsonb;
begin
  update jobs
  set details = jsonb_deep_merge(coalesce(details, '{}'::jsonb), p_patch)
  where id = p_job_id
  returning details into v_details;

  return v_details;
end;
$$;

grant execute on function jsonb_deep_merge(jsonb, jsonb) to authenticated;
grant execute on function merge_job_details(uuid, jsonb) to authenticated;
