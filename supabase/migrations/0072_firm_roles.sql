-- 0072: Directors and team members.
--
-- Until now every certifier login in a firm could see and do everything
-- the firm could. A firm that takes on an employee or a contract
-- certifier wants the opposite: the director runs the firm, and each
-- team member sees the projects they have been given and nothing else.
--
-- The role lives on the certifier row (not the profile), so the director
-- can set it before the person has a login and change it from the
-- Certifiers list without touching auth tables. Every certifier who
-- already holds a login becomes a director, so nothing changes for
-- anyone until a director says so.
--
-- A team member can open a project when they are its assigned
-- certifier, when they have been added to its team (job_members), or
-- when they are the inspector on one of its inspections. Every
-- job-child table already scopes itself through `jobs`, so tightening
-- the jobs policy tightens checklists, documents, inspections,
-- certificates and the rest along with it.

alter table certifiers
  add column if not exists firm_role text not null default 'staff'
  check (firm_role in ('director', 'staff'));

-- Anyone who can already sign in keeps the run of the firm.
update certifiers c
   set firm_role = 'director'
 where c.user_id is not null
    or exists (select 1 from profiles p where p.certifier_id = c.id and p.role = 'certifier');

-- Which certifier row the signed-in person is.
create or replace function current_certifier_id() returns uuid
  language sql stable security definer set search_path = public as
  $$ select certifier_id from profiles where id = auth.uid() $$;

-- A certifier login with no certifier row (the very first logins were
-- linked by hand and one or two may not be) counts as a director: that
-- is what they have always been able to do.
create or replace function is_director() returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1
      from profiles p
      left join certifiers c on c.id = p.certifier_id
     where p.id = auth.uid()
       and p.role = 'certifier'
       and (c.id is null or c.firm_role = 'director')
  )
$$;

-- The extra people on a project, beyond its assigned certifier.
create table if not exists job_members (
  job_id uuid not null references jobs(id) on delete cascade,
  certifier_id uuid not null references certifiers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, certifier_id)
);
create index if not exists job_members_certifier_idx on job_members(certifier_id);
alter table job_members enable row level security;

-- May the signed-in certifier open this project?
create or replace function can_access_job(p_job_id uuid) returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from jobs j
     where j.id = p_job_id
       and j.firm_id = current_firm_id()
       and (
         is_director()
         or j.assigned_certifier_id = current_certifier_id()
         or exists (select 1 from job_members m where m.job_id = j.id and m.certifier_id = current_certifier_id())
         or exists (select 1 from inspections i where i.job_id = j.id and i.inspector_certifier_id = current_certifier_id())
       )
  )
$$;

grant execute on function current_certifier_id() to authenticated;
grant execute on function is_director() to authenticated;
grant execute on function can_access_job(uuid) to authenticated;

-- Projects: the director sees the firm's; a team member sees theirs.
drop policy if exists "certifier firm crud jobs" on jobs;
create policy "certifier firm crud jobs" on jobs for all
  using (current_app_role() = 'certifier' and firm_id = current_firm_id() and (is_director() or can_access_job(id)))
  with check (current_app_role() = 'certifier' and firm_id = current_firm_id() and (is_director() or can_access_job(id)));

-- The team list: the director sets it, the team can read it.
drop policy if exists "director manages job members" on job_members;
create policy "director manages job members" on job_members for all
  using (current_app_role() = 'certifier' and is_director() and exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()))
  with check (current_app_role() = 'certifier' and is_director() and exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()));
drop policy if exists "team reads job members" on job_members;
create policy "team reads job members" on job_members for select
  using (current_app_role() = 'certifier' and can_access_job(job_id));

-- Quotes and invoices are the firm's money: the director's alone. The
-- fee-line and invoice-line tables scope themselves through these, so
-- they follow.
drop policy if exists "certifier firm crud quotes" on quotes;
create policy "certifier firm crud quotes" on quotes for all
  using (firm_id = current_firm_id() and is_director())
  with check (firm_id = current_firm_id() and is_director());
drop policy if exists "certifier firm crud invoices" on invoices;
create policy "certifier firm crud invoices" on invoices for all
  using (firm_id = current_firm_id() and is_director())
  with check (firm_id = current_firm_id() and is_director());

-- The firm's own settings: a team member can read them (certificates and
-- reports are built from them) but only a director changes them. These
-- are restrictive policies — they narrow what the existing ones allow
-- rather than replacing them — and they leave clients untouched.
do $$
declare
  t text;
begin
  foreach t in array array['firms', 'document_library_items', 'cdc_condition_sets', 'firm_document_wording', 'certificate_templates', 'cloud_backup_connections']
  loop
    execute format('drop policy if exists "director only writes" on %I', t);
    execute format('create policy "director only writes" on %I as restrictive for insert with check (is_director() or current_app_role() <> ''certifier'')', t);
    execute format('drop policy if exists "director only updates" on %I', t);
    execute format('create policy "director only updates" on %I as restrictive for update using (is_director() or current_app_role() <> ''certifier'')', t);
    execute format('drop policy if exists "director only deletes" on %I', t);
    execute format('create policy "director only deletes" on %I as restrictive for delete using (is_director() or current_app_role() <> ''certifier'')', t);
  end loop;
end $$;

-- Certifiers: a director manages the list; a team member may edit their
-- own card (signature, mobile, Portal email) but not their own role.
drop policy if exists "director only writes" on certifiers;
create policy "director only writes" on certifiers as restrictive for insert
  with check (is_director() or current_app_role() <> 'certifier');
drop policy if exists "director only deletes" on certifiers;
create policy "director only deletes" on certifiers as restrictive for delete
  using (is_director() or current_app_role() <> 'certifier');
drop policy if exists "own card or director updates" on certifiers;
create policy "own card or director updates" on certifiers as restrictive for update
  using (is_director() or current_app_role() <> 'certifier' or id = current_certifier_id())
  with check (is_director() or current_app_role() <> 'certifier' or (id = current_certifier_id() and firm_role = 'staff'));

-- The firm's records of itself — the audit log, the fault log, what the
-- backup holds, the assistant's note about the whole firm — are the
-- director's to read.
do $$
declare
  t text;
begin
  foreach t in array array['audit_events', 'error_events', 'cloud_backup_files', 'ai_briefings']
  loop
    execute format('drop policy if exists "director only reads" on %I', t);
    execute format('create policy "director only reads" on %I as restrictive for select using (is_director() or current_app_role() <> ''certifier'')', t);
  end loop;
end $$;

-- A team member who was invited by email finishes their login here: the
-- director's invite put their new auth user id on the certifier row, so
-- the row itself says who they are — nothing the person could type or
-- change is trusted.
create or replace function accept_certifier_invite()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_certifier certifiers%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'no authenticated user';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    return;
  end if;
  select * into v_certifier from certifiers where user_id = auth.uid() limit 1;
  if not found then
    return;
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into profiles (id, firm_id, role, certifier_id, full_name, email)
  values (auth.uid(), v_certifier.firm_id, 'certifier', v_certifier.id, v_certifier.name, v_email)
  on conflict (id) do nothing;
end;
$$;
grant execute on function accept_certifier_invite() to authenticated;
