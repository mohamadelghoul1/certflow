-- 0075: A firm marked as a demonstration.
--
-- The account used to show Certlyn to other certifiers is a firm like
-- any other — its own projects, its own clients, walled off from every
-- real firm by the same row security. The one thing it must never do is
-- send an email: its "clients" are made up, and a demonstration that
-- posts a certificate to a stranger is not a demonstration.
--
-- So the flag lives here, on the firm, rather than in a list of
-- addresses somewhere in the code: whatever the app is asked to send,
-- it looks the firm up first.

alter table firms add column if not exists demo boolean not null default false;

comment on column firms.demo is
  'A demonstration account: sample data, and no email is ever sent from it.';

-- Also here, and deliberately: the first cut of require_issue_approval
-- (migration 0074) refused every write that was not a signed-in
-- certifier — the service role, a background sweep, a SQL script —
-- because current_app_role() is null for those and `null <> 'certifier'`
-- is null rather than true. A database that has already run 0074 gets
-- the corrected function by running this.
create or replace function require_issue_approval(p_job_id uuid, p_stage text) returns void
  language plpgsql security definer set search_path = public as
$$
declare
  v_id uuid;
begin
  if coalesce(current_app_role(), '') <> 'certifier' or is_director() then
    return;
  end if;
  v_id := issue_approval_open(p_job_id, p_stage);
  if v_id is null then
    raise exception 'A director has to approve this before it can be issued.';
  end if;
  update issue_approvals set used_at = now() where id = v_id;
end;
$$;
