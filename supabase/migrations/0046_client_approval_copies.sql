-- The client's own copy of an issued approval.
--
-- A certificate does not stop moving once it is issued. The applicant
-- often ends up holding a copy the certifier does not have — the one
-- stamped and returned by council, the version endorsed on the NSW
-- Planning Portal, a scan of the signed original. Until now that copy
-- came back by email, and the job in CertFlow stayed one document short
-- of what actually exists.
--
-- These rows are deliberately separate from the certifier's own
-- pathway_certificate_versions.approval_file_path and
-- oc_records.approval_file_path. A client can add a copy; a client can
-- never overwrite the certificate that was issued. What was issued is
-- the firm's record, and nothing outside the firm gets to change it.

create table if not exists client_approval_copies (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  -- Which approval this is a copy of: the job's CDC/CC, or one of its
  -- Occupation Certificates (oc_record_id says which).
  kind text not null check (kind in ('pathway', 'oc')),
  oc_record_id uuid references oc_records(id) on delete cascade,
  file_path text not null,
  file_name text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_approval_copies_job_idx on client_approval_copies(job_id, created_at);

alter table client_approval_copies enable row level security;

drop policy if exists "certifier read client_approval_copies" on client_approval_copies;
create policy "certifier read client_approval_copies" on client_approval_copies for select
  using (
    current_app_role() = 'certifier'
    and exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id())
  );

-- The certifier can clear one out — a client who uploaded the wrong file
-- and asked for it to be taken down.
drop policy if exists "certifier delete client_approval_copies" on client_approval_copies;
create policy "certifier delete client_approval_copies" on client_approval_copies for delete
  using (
    current_app_role() = 'certifier'
    and exists (select 1 from jobs j where j.id = job_id and j.firm_id = current_firm_id())
  );

drop policy if exists "client read client_approval_copies" on client_approval_copies;
create policy "client read client_approval_copies" on client_approval_copies for select
  using (current_app_role() = 'client' and job_visible_to_client(job_id));

-- Adding a copy to a job they can already see. The row records who sent
-- it, so the certifier can tell a client's copy from their own.
drop policy if exists "client add client_approval_copies" on client_approval_copies;
create policy "client add client_approval_copies" on client_approval_copies for insert
  with check (
    current_app_role() = 'client'
    and job_visible_to_client(job_id)
    and uploaded_by = auth.uid()
    -- An OC copy has to name an Occupation Certificate on the same job,
    -- and a CDC/CC copy must not name one at all. The subquery reads
    -- oc_records under the client's own row security, so it also settles
    -- a question this policy never has to ask: a certificate that has
    -- not been released to the client is invisible to them, and a copy
    -- cannot be attached to something they cannot see.
    and (
      (kind = 'pathway' and oc_record_id is null)
      or (kind = 'oc' and exists (select 1 from oc_records r where r.id = oc_record_id and r.job_id = client_approval_copies.job_id))
    )
  );

-- Uploading the wrong file is the ordinary mistake here, so the person
-- who sent it can take it back — their own upload only.
drop policy if exists "client remove own client_approval_copies" on client_approval_copies;
create policy "client remove own client_approval_copies" on client_approval_copies for delete
  using (current_app_role() = 'client' and uploaded_by = auth.uid() and job_visible_to_client(job_id));
