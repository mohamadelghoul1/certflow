-- One booking request per inspection.
--
-- The screen now hides the form once a client has asked, but a rule that
-- only exists on a screen is not a rule: a stale tab, a double press, or
-- a second device would still overwrite the date the certifier is about
-- to confirm — and the certifier would confirm a day the client had
-- already moved.
--
-- So the refusal lives here, where the date is actually written. A
-- request stays with the certifier until they accept it or offer another
-- day; after that the date is settled and changing it is a phone call,
-- not a form.
--
-- Everything else about this function is unchanged from 0001 and 0048:
-- client-only, the job must be visible to them, no weekends, no earlier
-- than the lead time allows, and the Notice of Commencement checklist
-- must be complete.
--
-- Safe to run twice.

create or replace function client_book_inspection(p_inspection_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_earliest date;
  v_outcome text;
  v_booked boolean;
  v_confirmed boolean;
begin
  if current_app_role() <> 'client' then
    raise exception 'not a client user';
  end if;

  select job_id, outcome, booked_by_client, confirmed
    into v_job_id, v_outcome, v_booked, v_confirmed
    from inspections where id = p_inspection_id;

  if v_job_id is null or not job_visible_to_client(v_job_id) then
    raise exception 'inspection not found or not accessible';
  end if;

  if v_outcome <> 'pending' then
    raise exception 'this inspection has already been carried out';
  end if;

  if v_confirmed then
    raise exception 'this inspection is already booked — please call your certifier to change the date';
  end if;

  if v_booked then
    raise exception 'you have already asked for a date and your certifier is confirming it';
  end if;

  if noc_checklist_outstanding(v_job_id) > 0 then
    raise exception 'the Notice of Commencement checklist must be complete before an inspection can be booked';
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

-- A marker, so the System check page can tell whether this migration has
-- been run.
--
-- Everything above only changes what an existing function refuses — no
-- new table, no new column, and both versions turn a certifier away at
-- the same first line, so there is nothing about calling it that
-- distinguishes them. Rather than have the page guess, the migration
-- says so plainly.
create or replace function booking_request_lock_installed()
returns boolean
language sql
immutable
as $$ select true $$;

grant execute on function booking_request_lock_installed() to authenticated;
