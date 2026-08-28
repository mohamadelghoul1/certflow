-- An inspection cannot be booked until the Notice of Commencement
-- checklist is complete.
--
-- Building work does not start on the day the certificate is issued; it
-- starts once the Notice of Commencement has been given, and that waits
-- on the documents the NOC checklist asks for. A client booking a slab
-- inspection while the insurance certificate is still outstanding is
-- booking a visit to a site nobody may lawfully be working on.
--
-- Enforced here rather than by hiding the button, for the same reason
-- every other client rule in this app is: the portal is a screen, and a
-- screen can be left open from before the rule applied.
--
-- A job whose certifier has put nothing on the NOC checklist has nothing
-- to complete, so it does not block anything — the same rule the portal
-- already uses to decide whether the Occupation Certificate stage is
-- locked.

-- How many Notice of Commencement items a job is still waiting on. Named
-- once, here, so the rule below and anything that later needs the same
-- answer cannot drift apart — and so a deployment can tell whether this
-- migration has been run at all.
create or replace function noc_checklist_outstanding(p_job_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*) filter (where i.status <> 'approved')::int
  from checklist_items i
  join checklists c on c.id = i.checklist_id
  where c.job_id = p_job_id and c.kind = 'noc'
$$;

grant execute on function noc_checklist_outstanding(uuid) to authenticated;

create or replace function client_book_inspection(p_inspection_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_earliest date;
  v_noc_outstanding int;
begin
  if current_app_role() <> 'client' then
    raise exception 'not a client user';
  end if;

  select job_id into v_job_id from inspections where id = p_inspection_id;
  if v_job_id is null or not job_visible_to_client(v_job_id) then
    raise exception 'inspection not found or not accessible';
  end if;

  v_noc_outstanding := noc_checklist_outstanding(v_job_id);
  if v_noc_outstanding > 0 then
    raise exception 'Inspections can be booked once the Notice of Commencement checklist is complete. % item(s) are still outstanding.', v_noc_outstanding;
  end if;

  if extract(dow from p_date) in (0,6) then
    raise exception 'weekend dates are not bookable';
  end if;

  v_earliest := earliest_bookable_inspection_date();
  if p_date < v_earliest then
    raise exception 'date is earlier than the earliest bookable day (%)', v_earliest;
  end if;

  update inspections
  set date = p_date,
      booked_by_client = true,
      confirmed = false,
      updated_at = now()
  where id = p_inspection_id;
end;
$$;

grant execute on function client_book_inspection(uuid, date) to authenticated;
