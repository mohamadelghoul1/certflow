-- The standard condition sets a CDC is issued subject to.
--
-- The conditions are statute, not the firm's words: nine to sixteen
-- pages of the Environmental Planning and Assessment Regulation,
-- different for a greenfield dwelling, a demolition, an alteration.
-- They are not written in Certlyn and never will be — the firm holds
-- the PDF the department publishes, and the certifier says which one
-- this development is approved under.
--
-- A firm's own, and only a certifier's to see or change: which
-- conditions attach to a certificate is part of the approval.
--
-- Safe to run twice.

create table if not exists cdc_condition_sets (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  file_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cdc_condition_sets_firm_idx on cdc_condition_sets(firm_id);

alter table cdc_condition_sets enable row level security;

drop policy if exists "certifier manage own firm cdc condition sets" on cdc_condition_sets;
create policy "certifier manage own firm cdc condition sets" on cdc_condition_sets for all
  using (current_app_role() = 'certifier' and firm_id = current_firm_id())
  with check (current_app_role() = 'certifier' and firm_id = current_firm_id());
