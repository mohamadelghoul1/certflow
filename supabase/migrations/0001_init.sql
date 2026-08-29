-- =============================================================================
-- Certlyn — initial schema
--
-- Multi-tenant from day one (Build Brief §12): every row that belongs to a
-- firm carries firm_id, and Row Level Security (RLS) enforces the boundary
-- at the database itself, not just in application code.
--
-- Two kinds of logged-in users:
--   - "certifier" role: firm staff, full access to everything under their
--     own firm_id.
--   - "client" role: an architect/builder/owner, scoped to only the job(s)
--     they're attached to.
--
-- Run this whole file once in the Supabase SQL Editor for a brand new
-- project. See README.md for the plain-language walkthrough.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Firms & people
-- -----------------------------------------------------------------------------

create table firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abn text,
  postal_address text,
  office_address text,
  phone text,
  email text,
  website text,
  created_at timestamptz not null default now()
);

create table certifiers (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  registration_no text,
  registration_body text,
  signature_url text,
  pi_insurance_expiry date,
  registration_expiry date,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on certifiers(firm_id);

-- A reusable contact (architect / builder / owner) who can be attached to
-- one or more jobs, and optionally has a portal login of their own.
create table clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  type text not null default 'Other' check (type in ('Architect','Builder','Owner','Other')),
  company text,
  email text,
  phone text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on clients(firm_id);

-- One row per logged-in person (certifier staff OR client), 1:1 with
-- auth.users. This is what RLS policies key off of.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  firm_id uuid not null references firms(id) on delete cascade,
  role text not null check (role in ('certifier','client')),
  certifier_id uuid references certifiers(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Quotes
-- -----------------------------------------------------------------------------

create table quotes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  state text default 'NSW',
  project_type text,
  pathway text not null default 'CDC' check (pathway in ('CDC','CC')),
  required_start_date date,
  required_end_date date,
  valid_for text default '7 Days',
  proposal_address text,
  lot_section_plan text,
  project_title text,
  certifier_id uuid references certifiers(id) on delete set null,
  classifications jsonb not null default '[]',
  development_description text,
  owner_is_applicant boolean not null default true,
  applicant jsonb not null default '{}',
  owner jsonb not null default '{}',
  council_lga text,
  client_id uuid references clients(id) on delete set null,
  scope_of_works jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  payment_received_date date,
  terms_override text,
  linked_job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on quotes(firm_id);

create table quote_fee_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text not null,
  quantity text default '1',
  amount numeric(12,2) not null default 0,
  sort_order int not null default 0
);
create index on quote_fee_lines(quote_id);

-- -----------------------------------------------------------------------------
-- Jobs
-- -----------------------------------------------------------------------------

create table jobs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  address text not null,
  description text,
  job_types jsonb not null default '[]',
  pathway text not null default 'CDC' check (pathway in ('CDC','CC')),
  assigned_certifier_id uuid references certifiers(id) on delete set null,
  status text not null default 'active' check (status in ('active','complete')),
  client_id uuid references clients(id) on delete set null,

  -- Free-form structured detail — project number, zoning, BCA version,
  -- applicant/owner/council contacts, proposal specifics, certificate
  -- details (Lot/DP, Planning Portal ref, determination/lapse dates), etc.
  -- Kept as jsonb because this sub-form evolves independently of the rest
  -- of the schema; see README for the expected shape.
  details jsonb not null default '{}',

  critical_stage_inspections jsonb not null default '[1,2,3,4,5,6]',
  council_letter_override text,
  applicant_letter_override text,
  last_notified_at timestamptz,
  last_viewed_at timestamptz default now(),

  -- The original CDC/CC pathway certificate — one per job (modifications
  -- to it live in the separate `modifications` table below).
  pathway_generated boolean not null default false,
  pathway_generated_date date,
  pathway_issued_by uuid references certifiers(id) on delete set null,
  pathway_version int not null default 0,
  pathway_approval_uploaded boolean not null default false,
  pathway_approval_date date,
  pathway_approval_file_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on jobs(firm_id);
create index on jobs(client_id);

alter table quotes add constraint quotes_linked_job_fk foreign key (linked_job_id) references jobs(id) on delete set null;

-- Extra people (e.g. the owner, in addition to the primary client contact)
-- granted access to a specific job in the client portal.
create table job_shared_access (
  job_id uuid not null references jobs(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  primary key (job_id, client_id)
);

create table conditions_of_consent (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  text text not null,
  date_added date not null default current_date,
  created_at timestamptz not null default now()
);
create index on conditions_of_consent(job_id);

-- -----------------------------------------------------------------------------
-- Modifications to the original CDC/CC
-- -----------------------------------------------------------------------------

create table modifications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  reason text,
  generated boolean not null default false,
  generated_date date,
  issued_by uuid references certifiers(id) on delete set null,
  version int not null default 0,
  approval_uploaded boolean not null default false,
  approval_date date,
  approval_file_path text,
  created_at timestamptz not null default now()
);
create index on modifications(job_id);

-- -----------------------------------------------------------------------------
-- Occupation Certificates — Partial and Whole (no "Final OC")
-- -----------------------------------------------------------------------------

create table oc_records (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  type text not null check (type in ('partial','whole')),
  description text,
  generated_date date,
  issued_by uuid references certifiers(id) on delete set null,
  approval_uploaded boolean not null default false,
  approval_date date,
  approval_file_path text,
  created_at timestamptz not null default now()
);
create index on oc_records(job_id);

-- -----------------------------------------------------------------------------
-- Checklists (original CDC/CC, NOC, OC, or one per modification)
-- -----------------------------------------------------------------------------

create table checklists (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  kind text not null check (kind in ('pathway','noc','oc','modification')),
  modification_id uuid references modifications(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint modification_kind_pairs_with_modification_id
    check ((kind = 'modification') = (modification_id is not null))
);
create index on checklists(job_id);
-- One checklist per job for each of the non-modification kinds.
create unique index checklists_one_per_kind on checklists(job_id, kind) where kind <> 'modification';

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  title text not null,
  description text,
  category text,
  status text not null default 'requested' check (status in ('requested','submitted','approved')),
  version int not null default 0,
  revision text,
  document_date date,
  prepared_by text,
  drawing_number text,
  clause_ref text,
  requires_stamping boolean not null default false,
  file_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on checklist_items(checklist_id);

create table amendments (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  text text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on amendments(checklist_item_id);

-- -----------------------------------------------------------------------------
-- Inspections
-- -----------------------------------------------------------------------------

create table inspections (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  title text not null,
  description text,
  date date,
  outcome text not null default 'pending' check (outcome in ('pending','passed','failed','passed_subject_to')),
  inspector_certifier_id uuid references certifiers(id) on delete set null,
  report_sent boolean not null default false,
  report_sent_date date,
  report_file_path text,
  booked_by_client boolean not null default false,
  confirmed boolean not null default false,
  portal_reported boolean not null default false,
  portal_reported_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on inspections(job_id);

create table defects (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  text text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on defects(inspection_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================

-- Helper functions (SECURITY DEFINER so they can read `profiles` without
-- recursively triggering RLS on that same table).
create function current_firm_id() returns uuid
  language sql stable security definer set search_path = public as
  $$ select firm_id from profiles where id = auth.uid() $$;

create function current_app_role() returns text
  language sql stable security definer set search_path = public as
  $$ select role from profiles where id = auth.uid() $$;

create function current_client_id() returns uuid
  language sql stable security definer set search_path = public as
  $$ select client_id from profiles where id = auth.uid() $$;

-- Is the given job visible to the currently logged-in client?
create function job_visible_to_client(p_job_id uuid) returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from jobs j
    where j.id = p_job_id
      and (j.client_id = current_client_id()
           or exists (select 1 from job_shared_access s where s.job_id = j.id and s.client_id = current_client_id()))
  )
$$;

alter table firms enable row level security;
alter table certifiers enable row level security;
alter table clients enable row level security;
alter table profiles enable row level security;
alter table quotes enable row level security;
alter table quote_fee_lines enable row level security;
alter table jobs enable row level security;
alter table job_shared_access enable row level security;
alter table conditions_of_consent enable row level security;
alter table modifications enable row level security;
alter table oc_records enable row level security;
alter table checklists enable row level security;
alter table checklist_items enable row level security;
alter table amendments enable row level security;
alter table inspections enable row level security;
alter table defects enable row level security;

-- profiles: everyone can read their own row (needed to bootstrap the app);
-- nothing else is exposed.
create policy "read own profile" on profiles for select using (id = auth.uid());

-- firms: certifiers can read/update their own firm.
create policy "certifier read own firm" on firms for select using (id = current_firm_id());
create policy "certifier update own firm" on firms for update using (id = current_firm_id());

-- certifiers: firm staff manage their own firm's certifier registry; clients
-- can read certifiers of firms they have a job with (names/rego appear on
-- certificates and inspection reports).
create policy "certifier firm crud" on certifiers for all
  using (firm_id = current_firm_id() and current_app_role() = 'certifier')
  with check (firm_id = current_firm_id() and current_app_role() = 'certifier');
create policy "client read certifiers" on certifiers for select
  using (current_app_role() = 'client' and firm_id = current_firm_id());

-- clients (the contact-record table): firm staff manage; a client user can
-- read their own contact record.
create policy "certifier firm crud clients" on clients for all
  using (firm_id = current_firm_id() and current_app_role() = 'certifier')
  with check (firm_id = current_firm_id() and current_app_role() = 'certifier');
create policy "client read own record" on clients for select
  using (current_app_role() = 'client' and id = current_client_id());

-- quotes / fee lines: certifier-only (clients never see quotes in this
-- version — matches the brief, which scopes the client portal to jobs).
create policy "certifier firm crud quotes" on quotes for all
  using (firm_id = current_firm_id() and current_app_role() = 'certifier')
  with check (firm_id = current_firm_id() and current_app_role() = 'certifier');
create policy "certifier firm crud fee lines" on quote_fee_lines for all
  using (exists (select 1 from quotes q where q.id = quote_id and q.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from quotes q where q.id = quote_id and q.firm_id = current_firm_id()) and current_app_role() = 'certifier');

-- jobs: certifier full access within firm; client read-only on their own job(s).
create policy "certifier firm crud jobs" on jobs for all
  using (firm_id = current_firm_id() and current_app_role() = 'certifier')
  with check (firm_id = current_firm_id() and current_app_role() = 'certifier');
create policy "client read own jobs" on jobs for select
  using (current_app_role() = 'client' and job_visible_to_client(id));

create policy "certifier firm crud shared access" on job_shared_access for all
  using (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');

-- Every job-child table below follows the same two-policy shape: certifier
-- full access scoped by firm via the parent job, client read-only scoped by
-- job_visible_to_client().

create policy "certifier crud conditions" on conditions_of_consent for all
  using (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');
create policy "client read conditions" on conditions_of_consent for select
  using (current_app_role() = 'client' and job_visible_to_client(job_id));

create policy "certifier crud modifications" on modifications for all
  using (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');
create policy "client read modifications" on modifications for select
  using (current_app_role() = 'client' and job_visible_to_client(job_id));

create policy "certifier crud oc_records" on oc_records for all
  using (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');
create policy "client read oc_records" on oc_records for select
  using (current_app_role() = 'client' and job_visible_to_client(job_id));

create policy "certifier crud checklists" on checklists for all
  using (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');
create policy "client read checklists" on checklists for select
  using (current_app_role() = 'client' and job_visible_to_client(job_id));

create policy "certifier crud checklist_items" on checklist_items for all
  using (exists (select 1 from checklists c join jobs j on j.id = c.job_id where c.id = checklist_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from checklists c join jobs j on j.id = c.job_id where c.id = checklist_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');
create policy "client read checklist_items" on checklist_items for select
  using (current_app_role() = 'client' and exists (select 1 from checklists c where c.id = checklist_id and job_visible_to_client(c.job_id)));

create policy "certifier crud amendments" on amendments for all
  using (exists (select 1 from checklist_items i join checklists c on c.id = i.checklist_id join jobs j on j.id = c.job_id where i.id = checklist_item_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from checklist_items i join checklists c on c.id = i.checklist_id join jobs j on j.id = c.job_id where i.id = checklist_item_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');
create policy "client read amendments" on amendments for select
  using (current_app_role() = 'client' and exists (select 1 from checklist_items i join checklists c on c.id = i.checklist_id where i.id = checklist_item_id and job_visible_to_client(c.job_id)));

create policy "certifier crud inspections" on inspections for all
  using (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');
create policy "client read inspections" on inspections for select
  using (current_app_role() = 'client' and job_visible_to_client(job_id));

create policy "certifier crud defects" on defects for all
  using (exists (select 1 from inspections i join jobs j on j.id = i.job_id where i.id = inspection_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from inspections i join jobs j on j.id = i.job_id where i.id = inspection_id and j.firm_id = current_firm_id()) and current_app_role() = 'certifier');
create policy "client read defects" on defects for select
  using (current_app_role() = 'client' and exists (select 1 from inspections i where i.id = inspection_id and job_visible_to_client(i.job_id)));

-- =============================================================================
-- Client write actions — deliberately NOT plain table UPDATE grants.
--
-- Clients need to be able to (a) upload/resubmit a document and (b) book an
-- inspection, but nothing else. Those two actions carry real business rules
-- (version bumping, the exact lead-time/weekend booking rules in Build
-- Brief §15) that belong on the server, not trusted to the browser. These
-- are implemented as SECURITY DEFINER functions the client role can call,
-- instead of opening up direct UPDATE policies on checklist_items/inspections.
-- =============================================================================

create or replace function client_submit_document(p_item_id uuid, p_file_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
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

  update checklist_items
  set file_path = p_file_path,
      status = 'submitted',
      version = version + 1,
      updated_at = now()
  where id = p_item_id;
  -- Amendments are intentionally left as-is here — Build Brief §3: "amendment
  -- points stay until manually resolved" by the certifier, even after resubmission.
end;
$$;
grant execute on function client_submit_document(uuid, text) to authenticated;

-- Mirrors the exact booking rules from Build Brief §15:
--  - before 2pm -> earliest bookable day is tomorrow; at/after 2pm -> 2 days out
--  - a resulting date that falls on Sat/Sun is corrected to the following Tuesday
--  - a booking made *during* the weekend also resolves to Tuesday, never Monday
create or replace function earliest_bookable_inspection_date(p_now timestamptz default now())
returns date
language plpgsql
stable
as $$
declare
  v_local timestamp := p_now at time zone 'Australia/Sydney';
  v_dow int := extract(dow from v_local); -- 0 Sun .. 6 Sat
  v_date date := v_local::date;
  v_result date;
begin
  if v_dow = 6 then -- Saturday
    return v_date + 3; -- -> Tuesday
  elsif v_dow = 0 then -- Sunday
    return v_date + 2; -- -> Tuesday
  end if;

  if extract(hour from v_local) >= 14 then
    v_result := v_date + 2;
  else
    v_result := v_date + 1;
  end if;

  -- push off weekend
  if extract(dow from v_result) = 6 then
    v_result := v_result + 3;
  elsif extract(dow from v_result) = 0 then
    v_result := v_result + 2;
  end if;

  return v_result;
end;
$$;

create or replace function client_book_inspection(p_inspection_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_earliest date;
begin
  if current_app_role() <> 'client' then
    raise exception 'not a client user';
  end if;

  select job_id into v_job_id from inspections where id = p_inspection_id;
  if v_job_id is null or not job_visible_to_client(v_job_id) then
    raise exception 'inspection not found or not accessible';
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

-- =============================================================================
-- Storage
--
-- One private bucket. Every object path starts with "{firm_id}/{job_id}/...",
-- which is what the policies below check against.
-- =============================================================================

insert into storage.buckets (id, name, public) values ('certflow-files', 'certflow-files', false)
on conflict (id) do nothing;

create policy "certifier firm storage access" on storage.objects for all
  using (bucket_id = 'certflow-files' and current_app_role() = 'certifier' and (storage.foldername(name))[1] = current_firm_id()::text)
  with check (bucket_id = 'certflow-files' and current_app_role() = 'certifier' and (storage.foldername(name))[1] = current_firm_id()::text);

create policy "client read own job storage" on storage.objects for select
  using (bucket_id = 'certflow-files' and current_app_role() = 'client' and job_visible_to_client(((storage.foldername(name))[2])::uuid));

create policy "client upload own job storage" on storage.objects for insert
  with check (bucket_id = 'certflow-files' and current_app_role() = 'client' and job_visible_to_client(((storage.foldername(name))[2])::uuid));
