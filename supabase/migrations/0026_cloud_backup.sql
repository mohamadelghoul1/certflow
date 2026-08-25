-- A firm's own copy of its documents, kept in its own cloud storage.
--
-- Certifiers hold job records for years — longer than any subscription —
-- and a firm that cannot get its files out of a system is a firm that
-- cannot leave it. Connecting Dropbox or OneDrive gives them a copy that
-- is theirs, in a folder they can open without this software.

create table if not exists cloud_backup_connections (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  provider text not null check (provider in ('dropbox', 'onedrive')),
  -- Which account the firm connected, so they can see whose Dropbox this
  -- is going to rather than only that "a" connection exists.
  account_label text,
  -- Where the backup lives inside that account.
  root_folder text not null default '/CertFlow',
  access_token text not null,
  refresh_token text,
  -- Access tokens are short-lived; this is when the current one dies and
  -- the refresh token has to be used.
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  connected_by uuid references auth.users(id) on delete set null,
  last_sync_at timestamptz,
  last_sync_error text,
  -- One connection per provider per firm: connecting again replaces the
  -- account rather than quietly backing up to two places.
  unique (firm_id, provider)
);

alter table cloud_backup_connections enable row level security;

-- Deliberately no policy for ordinary users. These rows hold live access
-- tokens to a firm's own cloud storage, and nothing in the browser has
-- any reason to read them — every use goes through the server with the
-- service role. RLS with no policy denies everyone else by default, which
-- is exactly what is wanted here.

-- What has already been copied up, so a nightly backup sends the day's
-- new files rather than every file the firm has ever held.
create table if not exists cloud_backup_files (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references cloud_backup_connections(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  -- The path in our own storage. Uploads are written to a new timestamped
  -- path every time, so a path that has been copied up never changes and
  -- never needs copying again.
  storage_path text not null,
  remote_path text not null,
  bytes bigint,
  uploaded_at timestamptz not null default now(),
  unique (connection_id, storage_path)
);
create index if not exists cloud_backup_files_job_idx on cloud_backup_files(connection_id, job_id);

alter table cloud_backup_files enable row level security;

-- Read-only to the firm's own certifiers, so the app can show what has
-- been backed up and when. Writing is the server's job.
drop policy if exists "certifier read cloud_backup_files" on cloud_backup_files;
create policy "certifier read cloud_backup_files" on cloud_backup_files for select
  using (
    current_app_role() = 'certifier'
    and exists (
      select 1 from cloud_backup_connections c
      where c.id = connection_id and c.firm_id = current_firm_id()
    )
  );
