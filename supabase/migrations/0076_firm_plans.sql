-- 0076: What each firm is charged, and what they have used.
--
-- Certlyn is sold to a firm as a monthly fee that covers a number of new
-- projects, with a per-project charge past that. The terms differ from
-- firm to firm — an introductory rate for the first months, then the
-- standard one — so they are recorded per firm rather than assumed.
--
-- Nothing here charges anybody. It is the record the owner reads to
-- raise an invoice, and the number a firm sees so a bill is never a
-- surprise.

-- A project brought across from another system when a firm joins is not
-- a project Certlyn sold them: it is their existing work, and it is
-- excluded from the count.
alter table jobs add column if not exists imported boolean not null default false;
create index if not exists jobs_firm_created_idx on jobs(firm_id, created_at);

create table if not exists firm_plans (
  firm_id uuid primary key references firms(id) on delete cascade,
  -- The day the paid arrangement starts. The introductory months are
  -- counted from here, so two firms joining in different months each
  -- get their own first six.
  started_on date not null default current_date,
  intro_months int not null default 6 check (intro_months >= 0),
  -- Held in cents, so no arithmetic on this ever rounds.
  intro_fee_cents int not null default 9900 check (intro_fee_cents >= 0),
  standard_fee_cents int not null default 39900 check (standard_fee_cents >= 0),
  included_projects int not null default 30 check (included_projects >= 0),
  extra_project_fee_cents int not null default 2500 check (extra_project_fee_cents >= 0),
  notes text,
  updated_at timestamptz not null default now()
);

alter table firm_plans enable row level security;

-- Which firm runs Certlyn, as opposed to the firms using it. A database
-- where no firm is marked (migration 0068 not run, or one firm only)
-- treats the oldest firm as the owner — the same answer the app gives.
create or replace function is_platform_owner() returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from profiles p join firms f on f.id = p.firm_id
     where p.id = auth.uid()
       and p.role = 'certifier'
       and (f.platform_owner or not exists (select 1 from firms where platform_owner))
  )
$$;
grant execute on function is_platform_owner() to authenticated;

-- The owner sets the terms; a firm reads its own and changes nothing.
drop policy if exists "owner manages firm plans" on firm_plans;
create policy "owner manages firm plans" on firm_plans for all
  using (current_app_role() = 'certifier' and is_platform_owner())
  with check (current_app_role() = 'certifier' and is_platform_owner());
drop policy if exists "firm reads own plan" on firm_plans;
create policy "firm reads own plan" on firm_plans for select
  using (current_app_role() = 'certifier' and firm_id = current_firm_id());

-- Every firm the owner can see, with what it has used in one month.
-- A function rather than a view so the month is an argument, and
-- security definer so the owner can count across firms — which row
-- security otherwise, and rightly, forbids.
create or replace function firm_usage(p_month text)
returns table (
  firm_id uuid,
  firm_name text,
  created_on date,
  billable_projects bigint,
  imported_projects bigint,
  total_projects bigint
)
language sql stable security definer set search_path = public as
$$
  select f.id,
         f.name,
         f.created_at::date,
         count(j.id) filter (where j.id is not null and not j.imported),
         count(j.id) filter (where j.id is not null and j.imported),
         count(j.id)
    from firms f
    left join jobs j
      on j.firm_id = f.id
     and to_char(j.created_at at time zone 'Australia/Sydney', 'YYYY-MM') = p_month
   where is_platform_owner()
     and coalesce(f.demo, false) = false
   group by f.id, f.name, f.created_at
   order by f.name
$$;
grant execute on function firm_usage(text) to authenticated;

-- The same count for one firm, which is what that firm sees of itself.
-- Deleted projects still count: they were created, and a firm cannot
-- unsell a project by deleting it after the fact.
create or replace function my_firm_usage(p_month text)
returns bigint
language sql stable security definer set search_path = public as
$$
  select count(*)
    from jobs j
   where j.firm_id = current_firm_id()
     and not j.imported
     and to_char(j.created_at at time zone 'Australia/Sydney', 'YYYY-MM') = p_month
$$;
grant execute on function my_firm_usage(text) to authenticated;
