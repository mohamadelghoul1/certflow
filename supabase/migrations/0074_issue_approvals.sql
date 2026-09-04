-- 0074: A director's sign-off before a team member issues.
--
-- A team member can prepare a CDC, CC, modified certificate or OC in
-- full, but pressing Issue now needs a director to have said yes. The
-- request and the decision are both recorded — who asked, who decided,
-- when, and any note — so the file shows how the certificate came to be
-- issued.
--
-- An approval covers one issue and is spent by it: regenerating, or
-- issuing a second OC, asks again. Directors are not gated; they are
-- the approval.

create table if not exists issue_approvals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  -- 'pathway' covers the CDC/CC and a modified certificate — both
  -- produce a certificate version. 'oc' is an Occupation Certificate.
  stage text not null check (stage in ('pathway', 'oc')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_by uuid references certifiers(id) on delete set null,
  requested_at timestamptz not null default now(),
  request_note text,
  decided_by uuid references certifiers(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  -- Set when the certificate is actually issued under this approval.
  used_at timestamptz
);
create index if not exists issue_approvals_job_idx on issue_approvals(job_id);
-- One live request per stage: pressing the button twice asks once.
create unique index if not exists issue_approvals_one_open_idx
  on issue_approvals(job_id, stage)
  where used_at is null and status in ('pending', 'approved');

alter table issue_approvals enable row level security;

-- Anyone on the project sees where the request is up to; only someone
-- on the project raises one, and only a director decides it.
drop policy if exists "team reads issue approvals" on issue_approvals;
create policy "team reads issue approvals" on issue_approvals for select
  using (current_app_role() = 'certifier' and can_access_job(job_id));
drop policy if exists "team requests approval to issue" on issue_approvals;
create policy "team requests approval to issue" on issue_approvals for insert
  with check (
    current_app_role() = 'certifier'
    and can_access_job(job_id)
    and not is_inspector()
    and status = 'pending'
    and decided_by is null
    and used_at is null
  );
drop policy if exists "director decides issue approvals" on issue_approvals;
create policy "director decides issue approvals" on issue_approvals for update
  using (current_app_role() = 'certifier' and is_director() and can_access_job(job_id))
  with check (current_app_role() = 'certifier' and is_director() and can_access_job(job_id));
drop policy if exists "director clears issue approvals" on issue_approvals;
create policy "director clears issue approvals" on issue_approvals for delete
  using (current_app_role() = 'certifier' and is_director() and can_access_job(job_id));

-- Is there a director's yes waiting to be used on this stage?
create or replace function issue_approval_open(p_job_id uuid, p_stage text) returns uuid
  language sql stable security definer set search_path = public as
$$
  select id from issue_approvals
   where job_id = p_job_id and stage = p_stage and status = 'approved' and used_at is null
   order by decided_at desc nulls last
   limit 1
$$;
grant execute on function issue_approval_open(uuid, text) to authenticated;

-- The gate itself. A certifier who is not a director may only create a
-- certificate where a director has approved this issue, and the
-- approval is spent in the same statement — so one yes cannot issue
-- two certificates, however the button is pressed.
create or replace function require_issue_approval(p_job_id uuid, p_stage text) returns void
  language plpgsql security definer set search_path = public as
$$
declare
  v_id uuid;
begin
  if current_app_role() <> 'certifier' or is_director() then
    return;
  end if;
  v_id := issue_approval_open(p_job_id, p_stage);
  if v_id is null then
    raise exception 'A director has to approve this before it can be issued.';
  end if;
  update issue_approvals set used_at = now() where id = v_id;
end;
$$;
grant execute on function require_issue_approval(uuid, text) to authenticated;

create or replace function pathway_version_needs_approval() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  perform require_issue_approval(new.job_id, 'pathway');
  return new;
end;
$$;
drop trigger if exists pathway_version_needs_approval on pathway_certificate_versions;
create trigger pathway_version_needs_approval
  before insert on pathway_certificate_versions
  for each row execute function pathway_version_needs_approval();

create or replace function oc_record_needs_approval() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  perform require_issue_approval(new.job_id, 'oc');
  return new;
end;
$$;
drop trigger if exists oc_record_needs_approval on oc_records;
create trigger oc_record_needs_approval
  before insert on oc_records
  for each row execute function oc_record_needs_approval();

-- A decision is a director's, and a decided request is not re-decided
-- by editing it: the guard keeps the record of who said what honest.
create or replace function issue_approvals_guard() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if current_app_role() = 'certifier' and not is_director()
     and new.status is distinct from old.status then
    raise exception 'Only a director approves an issue.';
  end if;
  if old.status <> 'pending' and new.status is distinct from old.status then
    raise exception 'That request has already been decided.';
  end if;
  return new;
end;
$$;
drop trigger if exists issue_approvals_guard on issue_approvals;
create trigger issue_approvals_guard
  before update on issue_approvals
  for each row execute function issue_approvals_guard();
