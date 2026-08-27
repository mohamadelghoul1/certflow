-- Review outcomes waiting to be mentioned in an email to the client:
-- a document approved, or changes requested on one. One row per event;
-- notified_at marks when a summary email mentioned it. The mirror of
-- portal_uploads, which flows the other way.
create table if not exists review_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  item_title text,
  kind text not null check (kind in ('approved', 'changes')),
  note text,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

-- No policies on purpose: only the server itself (service role) reads
-- or writes these rows.
alter table review_events enable row level security;

create index if not exists review_events_unnotified on review_events (job_id) where notified_at is null;
