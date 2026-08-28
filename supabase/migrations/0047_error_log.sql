-- What broke, so somebody hears about it.
--
-- Until now a failure was visible only to the person it happened to.
-- They saw a broken page, the server wrote a line to a log nobody reads,
-- and unless that person thought to report it, nothing else in the world
-- knew. A firm relying on this software cannot be the only fault
-- detector it has.
--
-- One row per distinct fault rather than per occurrence. A page failing
-- four hundred times in a loop is one problem, and four hundred rows
-- would bury the other three problems that happened that week.
--
-- (0046 was used briefly by a feature that has since been removed. This
-- picks up at 0047 so the two can never be confused.)

create table if not exists error_events (
  id uuid primary key default gen_random_uuid(),
  -- What makes two failures the same failure. See lib/errorLog.ts.
  fingerprint text not null unique,
  -- Null when the failure happened before anyone was identified — a
  -- crash on the login page belongs to no firm.
  firm_id uuid references firms(id) on delete set null,
  source text not null check (source in ('server', 'browser')),
  route text,
  method text,
  route_type text,
  message text not null,
  -- React replaces the real error with a digest in production; it is the
  -- only thing tying a screen's "something went wrong" to a server log.
  digest text,
  stack text,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_user_id uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists error_events_recent_idx on error_events(last_seen_at desc);

alter table error_events enable row level security;

-- Certifiers see their own firm's faults, and the ones that happened
-- before any firm was known.
drop policy if exists "certifier read error_events" on error_events;
create policy "certifier read error_events" on error_events for select
  using (current_app_role() = 'certifier' and (firm_id is null or firm_id = current_firm_id()));

-- Marking one handled is the only edit allowed. Nothing can delete a
-- fault or rewrite what it said — same rule as the audit log.
drop policy if exists "certifier resolve error_events" on error_events;
create policy "certifier resolve error_events" on error_events for update
  using (current_app_role() = 'certifier' and (firm_id is null or firm_id = current_firm_id()))
  with check (current_app_role() = 'certifier' and (firm_id is null or firm_id = current_firm_id()));

-- Recording a fault: insert it, or count another occurrence of one
-- already known. Returns true the first time a fault is seen, which is
-- what decides whether anyone gets emailed — the hundredth occurrence
-- of a known problem is not news.
--
-- Written as one statement because the alternative — read, decide,
-- write — loses occurrences whenever two requests fail at once, which
-- is exactly what happens when something is properly broken.
create or replace function record_error_event(
  p_fingerprint text,
  p_firm_id uuid,
  p_source text,
  p_route text,
  p_method text,
  p_route_type text,
  p_message text,
  p_digest text,
  p_stack text,
  p_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occurrences integer;
begin
  insert into error_events (fingerprint, firm_id, source, route, method, route_type, message, digest, stack, last_user_id)
  values (
    p_fingerprint,
    p_firm_id,
    case when p_source = 'browser' then 'browser' else 'server' end,
    left(p_route, 300),
    left(p_method, 12),
    left(p_route_type, 40),
    left(coalesce(nullif(p_message, ''), 'Unknown error'), 2000),
    left(p_digest, 120),
    left(p_stack, 8000),
    p_user_id
  )
  on conflict (fingerprint) do update
    set occurrences = error_events.occurrences + 1,
        last_seen_at = now(),
        last_user_id = coalesce(excluded.last_user_id, error_events.last_user_id),
        message = excluded.message,
        stack = coalesce(excluded.stack, error_events.stack),
        -- A firm learned later fills in a blank; it never overwrites one.
        firm_id = coalesce(error_events.firm_id, excluded.firm_id),
        -- A fault that comes back was not fixed.
        resolved_at = null,
        resolved_by = null
  returning occurrences into v_occurrences;

  return v_occurrences = 1;
end;
$$;

-- Only the server records faults. Nothing signed in through the browser
-- can write to this table directly.
revoke all on function record_error_event(text, uuid, text, text, text, text, text, text, text, uuid) from public;
grant execute on function record_error_event(text, uuid, text, text, text, text, text, text, text, uuid) to service_role;
