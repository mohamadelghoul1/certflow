-- The firm's own builders list.
--
-- The same handful of builders appear across a certifier's jobs, and
-- their licence numbers do not change between projects. Saved once —
-- from any job's Details page — a builder can be picked on the next
-- project instead of retyped. Firm-scoped like everything else; the
-- job keeps its own copy of the details in jobs.details, so editing
-- the list never rewrites what a certificate already recorded.

create table contractors (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  company text not null default '',
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  licence_no text not null default '',
  created_at timestamptz not null default now()
);
create index on contractors(firm_id);

alter table contractors enable row level security;
create policy "certifier firm crud contractors" on contractors for all
  using (firm_id = current_firm_id() and current_app_role() = 'certifier')
  with check (firm_id = current_firm_id() and current_app_role() = 'certifier');
