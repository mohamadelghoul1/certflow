-- The inspection diary as a calendar subscription.
--
-- A phone's calendar app cannot log in. It fetches one URL, forever, with
-- no session and no cookie — so the URL itself has to be the credential.
-- Each certifier gets an unguessable token; the feed it addresses shows
-- that certifier's firm's inspections and nothing else.
--
-- The token lives in its own table rather than on certifiers, because a
-- client with a portal login can read every column of their firm's
-- certifiers row ("client read certifiers" in 0001). A token sitting
-- there would let any builder subscribe to the firm's entire inspection
-- diary across every job, including jobs that are not theirs. Row
-- security here admits certifiers only.
--
-- Safe to run twice.

create table if not exists certifier_calendar_feeds (
  certifier_id uuid primary key references certifiers(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table certifier_calendar_feeds enable row level security;

drop policy if exists "certifier read own firm calendar feeds" on certifier_calendar_feeds;
create policy "certifier read own firm calendar feeds" on certifier_calendar_feeds for select
  using (
    current_app_role() = 'certifier'
    and exists (select 1 from certifiers c where c.id = certifier_id and c.firm_id = current_firm_id())
  );

-- Every certifier the firm already has, and every one added from here on.
insert into certifier_calendar_feeds (certifier_id)
select id from certifiers
on conflict (certifier_id) do nothing;

create or replace function issue_calendar_feed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into certifier_calendar_feeds (certifier_id) values (new.id)
  on conflict (certifier_id) do nothing;
  return new;
end;
$$;

drop trigger if exists certifiers_issue_calendar_feed on certifiers;
create trigger certifiers_issue_calendar_feed after insert on certifiers
  for each row execute function issue_calendar_feed();

-- An earlier draft of this migration put the token on certifiers itself.
-- If that ran, the tokens are carried across and the column is dropped,
-- so a client can no longer read one.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'certifiers' and column_name = 'calendar_token') then
    update certifier_calendar_feeds f
       set token = c.calendar_token
      from certifiers c
     where c.id = f.certifier_id and c.calendar_token is not null;
    alter table certifiers drop column calendar_token;
  end if;
end $$;

-- Reading the feed happens with no signed-in user at all, so the route
-- looks the token up through this: it answers with one firm id and
-- nothing else, and cannot be used to read a name, an email, or any
-- other certifier's token.
create or replace function certifier_for_calendar_token(p_token uuid)
returns table (certifier_id uuid, firm_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.firm_id, c.name
  from certifier_calendar_feeds f
  join certifiers c on c.id = f.certifier_id
  where f.token = p_token
$$;

revoke all on function certifier_for_calendar_token(uuid) from public, anon, authenticated;

-- A certifier who believes their calendar URL has been shared can make
-- the old one stop working. Firm-scoped: it can only ever reset a token
-- belonging to the caller's own firm.
create or replace function reset_calendar_token(p_certifier_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fresh uuid;
begin
  update certifier_calendar_feeds f
     set token = gen_random_uuid()
    from certifiers c
   where c.id = f.certifier_id
     and f.certifier_id = p_certifier_id
     and c.firm_id = current_firm_id()
  returning f.token into fresh;
  return fresh;
end;
$$;

grant execute on function reset_calendar_token(uuid) to authenticated;
