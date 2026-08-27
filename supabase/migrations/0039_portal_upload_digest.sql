-- Client uploads waiting to be mentioned in a summary email to the
-- certifier. One row per document sent in from the portal; notified_at
-- marks when a summary email mentioned it, and stays null until one has.
create table if not exists portal_uploads (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  item_title text,
  file_name text,
  uploaded_at timestamptz not null default now(),
  notified_at timestamptz
);

-- No policies on purpose: only the server itself (service role, which
-- bypasses row security) reads or writes these rows. Neither clients
-- nor certifiers have any business touching them directly.
alter table portal_uploads enable row level security;

create index if not exists portal_uploads_unnotified on portal_uploads (job_id) where notified_at is null;
