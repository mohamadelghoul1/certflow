-- Engagement agreements signed online.
--
-- A written agreement has to be in place before certification work
-- starts. It was the last part of the job still living on paper: print,
-- post or email, wait, chase, scan the signed copy back in.
--
-- The certifier uploads the agreement they already use, names who has to
-- sign it, and each signatory gets their own private link. They need no
-- Certlyn login — an owner is often not the person using the portal —
-- and the agreement is only complete once every one of them has signed.
create table if not exists engagement_agreements (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  firm_id uuid not null references firms(id) on delete cascade,
  file_path text not null,
  file_name text,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Who has to sign, and what they did about it. The token is the emailed
-- link: long, random, and the only thing standing between a stranger and
-- this agreement, so it is never shown anywhere but in that person's own
-- email.
create table if not exists engagement_signatories (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references engagement_agreements(id) on delete cascade,
  name text not null,
  email text not null,
  role text,
  token text not null unique,
  sent_at timestamptz,
  signed_at timestamptz,
  signed_name text,
  -- An optional drawn signature, kept as an image the certificate of
  -- signing can print. The typed name and the record below are what
  -- actually evidence the agreement.
  signature_image text,
  signed_ip text,
  signed_user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists engagement_agreements_job on engagement_agreements (job_id);
create index if not exists engagement_signatories_agreement on engagement_signatories (agreement_id);

alter table engagement_agreements enable row level security;
alter table engagement_signatories enable row level security;

-- Certifiers manage their own firm's agreements. Signatories reach
-- theirs by token through the server, which uses the service role and
-- so needs no policy of its own — there is deliberately no policy that
-- would let an anonymous caller read these tables directly.
drop policy if exists "certifier manage engagement_agreements" on engagement_agreements;
create policy "certifier manage engagement_agreements" on engagement_agreements for all
  using (current_app_role() = 'certifier' and firm_id = current_firm_id())
  with check (current_app_role() = 'certifier' and firm_id = current_firm_id());

drop policy if exists "certifier manage engagement_signatories" on engagement_signatories;
create policy "certifier manage engagement_signatories" on engagement_signatories for all
  using (
    current_app_role() = 'certifier'
    and exists (select 1 from engagement_agreements a where a.id = agreement_id and a.firm_id = current_firm_id())
  )
  with check (
    current_app_role() = 'certifier'
    and exists (select 1 from engagement_agreements a where a.id = agreement_id and a.firm_id = current_firm_id())
  );
