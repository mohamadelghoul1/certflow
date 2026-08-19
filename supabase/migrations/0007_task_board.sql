-- A free-form internal task board (lists + checklist-style tasks), shown
-- on the dashboard below the automated "Needs your attention" list. Unlike
-- everything else in the schema, these aren't derived from job records —
-- they're a general-purpose workflow board the certifier manages by hand
-- (e.g. "Payments", "Neighbouring Notifications"), so lists and their
-- tasks are plain free text with no structural link to a specific job.
-- Certifier-only; clients never see this.

create table task_lists (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on task_lists(firm_id);

create table manual_tasks (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references task_lists(id) on delete cascade,
  text text not null,
  note text,
  completed boolean not null default false,
  completed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on manual_tasks(list_id);

alter table task_lists enable row level security;
alter table manual_tasks enable row level security;

create policy "certifier crud task_lists" on task_lists for all
  using (firm_id = current_firm_id() and current_app_role() = 'certifier')
  with check (firm_id = current_firm_id() and current_app_role() = 'certifier');

create policy "certifier crud manual_tasks" on manual_tasks for all
  using (exists (select 1 from task_lists l where l.id = list_id and l.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from task_lists l where l.id = list_id and l.firm_id = current_firm_id()) and current_app_role() = 'certifier');

-- Seed every existing firm with a starter set of lists matching common
-- NSW certifier workflow stages — rename, delete, or add to freely from
-- the dashboard afterward.
insert into task_lists (firm_id, title, sort_order)
select f.id, l.title, l.sort_order
from firms f
cross join (values
  ('CDC/CC Assessments', 0),
  ('CDC/CC Approvals Typing', 1),
  ('OC Assessments', 2),
  ('OC Approvals Typing', 3),
  ('PC Appointment', 4),
  ('Neighbouring Notifications', 5),
  ('Payments', 6),
  ('Inspections', 7)
) as l(title, sort_order);
