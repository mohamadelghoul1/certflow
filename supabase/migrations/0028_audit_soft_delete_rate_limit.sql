-- A record of what happened, jobs that can come back, and a limit on how
-- often the public parts of the app can be hit.
--
-- Three things that only matter once other people depend on the software,
-- which is exactly when it is too late to add them.

-- =============================================================================
-- Soft delete
-- =============================================================================
--
-- Deleting a job removed it and its files outright. A certifier has to be
-- able to account for a job years later, and "someone deleted it and we
-- have no record" is not an answer. A deleted job now leaves the lists
-- and stops being counted, but it is still there and can be brought back.

alter table jobs
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists jobs_live_idx on jobs(firm_id) where deleted_at is null;

alter table pathway_certificate_versions
  add column if not exists deleted_at timestamptz;

-- =============================================================================
-- Audit log
-- =============================================================================
--
-- The Audit page reconstructed events from current state, so anything
-- undone left no trace: a deleted job, an edited date, a removed
-- certificate version. This is written as things happen instead.
--
-- Append-only by construction: certifiers can read their firm's events
-- and insert new ones, and there is deliberately no update or delete
-- policy, so a record cannot be altered or quietly removed afterwards.

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  -- Kept as plain text rather than a foreign key: the point of a log is
  -- that it survives the thing it describes being deleted.
  job_id uuid,
  job_address text,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  -- What happened, as a stable machine-readable name: job.deleted,
  -- certificate.issued, inspection.signed, email.failed.
  action text not null,
  -- The same thing in words, so the page reads without a lookup table.
  summary text not null,
  detail jsonb,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error')),
  created_at timestamptz not null default now()
);
create index if not exists audit_events_firm_idx on audit_events(firm_id, created_at desc);
create index if not exists audit_events_severity_idx on audit_events(firm_id, severity, created_at desc) where severity <> 'info';

alter table audit_events enable row level security;

drop policy if exists "certifier read audit_events" on audit_events;
drop policy if exists "certifier append audit_events" on audit_events;

create policy "certifier read audit_events" on audit_events for select
  using (current_app_role() = 'certifier' and firm_id = current_firm_id());

create policy "certifier append audit_events" on audit_events for insert
  with check (current_app_role() = 'certifier' and firm_id = current_firm_id());

-- =============================================================================
-- Rate limiting
-- =============================================================================
--
-- The client portal is public, and the approved-set download is the most
-- expensive thing the app does. Counting in the application's memory does
-- not work when it runs as separate short-lived functions, so the count
-- lives here where every one of them can see it.

create table if not exists rate_limit_hits (
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);
create index if not exists rate_limit_hits_window_idx on rate_limit_hits(window_start);

-- Row level security on with no policies at all, which denies everyone.
-- Nobody reads or writes this table directly: a counter someone can
-- reach is a counter they can reset, which would leave the limit below
-- doing nothing. Only the function below touches it, and it runs as its
-- owner rather than as the caller.
alter table rate_limit_hits enable row level security;

-- Records one hit and says whether the caller is still within its
-- allowance. Counting and deciding in one statement, because two calls
-- racing each other is exactly the case a rate limit exists for.
create or replace function record_rate_limit_hit(p_bucket text, p_window_seconds int, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits int;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limit_hits (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = rate_limit_hits.hits + 1
  returning hits into v_hits;

  -- Old windows are cleared out as they are passed, so the table does not
  -- grow without bound and nothing has to be scheduled to tidy it.
  delete from rate_limit_hits where window_start < now() - interval '1 day';

  return v_hits <= p_limit;
end;
$$;

grant execute on function record_rate_limit_hit(text, int, int) to anon, authenticated;
