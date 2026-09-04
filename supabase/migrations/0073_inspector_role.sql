-- 0073: The inspector role.
--
-- Between a team member and nothing: a certifier who carries out the
-- inspections they are given and nothing else. They open their
-- projects, read the approved documents against which they inspect,
-- and record what they found — outcome, issues, photos, notes, the
-- signed report. They do not report to the NSW Planning Portal (the
-- firm does that, owning the two-day clock), and they cannot change
-- the project: not its details, not a checklist, not a document, not
-- a certificate.
--
-- Same shape as 0072: the screens hide what an inspector cannot do,
-- and this file makes the database refuse it even when asked directly.

alter table certifiers drop constraint if exists certifiers_firm_role_check;
alter table certifiers add constraint certifiers_firm_role_check
  check (firm_role in ('director', 'staff', 'inspector'));

create or replace function is_inspector() returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1
      from profiles p
      join certifiers c on c.id = p.certifier_id
     where p.id = auth.uid()
       and p.role = 'certifier'
       and c.firm_role = 'inspector'
  )
$$;
grant execute on function is_inspector() to authenticated;

-- The project and everything that makes up its paperwork: an inspector
-- reads, and only reads. Restrictive policies, so the existing ones
-- still decide who else may do what; clients are untouched.
do $$
declare
  t text;
begin
  foreach t in array array['jobs', 'checklists', 'checklist_items', 'checklist_item_files', 'amendments',
                           'conditions_of_consent', 'modifications', 'oc_records',
                           'pathway_certificate_versions', 'job_shared_access', 'job_members']
  loop
    execute format('drop policy if exists "inspector never writes" on %I', t);
    execute format('create policy "inspector never writes" on %I as restrictive for insert with check (current_app_role() <> ''certifier'' or not is_inspector())', t);
    execute format('drop policy if exists "inspector never updates" on %I', t);
    execute format('create policy "inspector never updates" on %I as restrictive for update using (current_app_role() <> ''certifier'' or not is_inspector())', t);
    execute format('drop policy if exists "inspector never deletes" on %I', t);
    execute format('create policy "inspector never deletes" on %I as restrictive for delete using (current_app_role() <> ''certifier'' or not is_inspector())', t);
  end loop;
end $$;

-- Inspections themselves: an inspector works on the ones that exist —
-- recording is an update — but the list of what gets inspected is the
-- firm's, so no adding and no removing. Their photos and issues are
-- their own work and stay writable.
drop policy if exists "inspector never adds inspections" on inspections;
create policy "inspector never adds inspections" on inspections as restrictive for insert
  with check (current_app_role() <> 'certifier' or not is_inspector());
drop policy if exists "inspector never removes inspections" on inspections;
create policy "inspector never removes inspections" on inspections as restrictive for delete
  using (current_app_role() <> 'certifier' or not is_inspector());

-- Within an inspection row, two things stay the firm's even though the
-- row is writable: the Portal record, and who the inspector is. A
-- policy cannot see single columns, so a trigger holds this line.
create or replace function inspections_inspector_guard() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if current_app_role() = 'certifier' and is_inspector() then
    if new.portal_reported is distinct from old.portal_reported
       or new.portal_reported_date is distinct from old.portal_reported_date
       or new.portal_child_case_id is distinct from old.portal_child_case_id then
      raise exception 'Reporting to the NSW Planning Portal is done by the firm, not the inspector.';
    end if;
    if new.inspector_certifier_id is distinct from old.inspector_certifier_id then
      raise exception 'Who inspects is assigned by the firm.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists inspections_inspector_guard on inspections;
create trigger inspections_inspector_guard
  before update on inspections
  for each row execute function inspections_inspector_guard();

-- A person's role is set by a director, full stop. 0072 held this line
-- inside the own-card policy's with check, which would also have
-- stopped an inspector saving their own mobile number (the check
-- demanded the stored role be 'staff') — a trigger says exactly what
-- is meant instead, and the policy goes back to saying only whose card
-- may be edited.
create or replace function certifiers_role_guard() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if current_app_role() = 'certifier' and not is_director()
     and new.firm_role is distinct from old.firm_role then
    raise exception 'Only a director changes roles.';
  end if;
  return new;
end;
$$;
drop trigger if exists certifiers_role_guard on certifiers;
create trigger certifiers_role_guard
  before update on certifiers
  for each row execute function certifiers_role_guard();

drop policy if exists "own card or director updates" on certifiers;
create policy "own card or director updates" on certifiers as restrictive for update
  using (is_director() or current_app_role() <> 'certifier' or id = current_certifier_id())
  with check (is_director() or current_app_role() <> 'certifier' or id = current_certifier_id());
