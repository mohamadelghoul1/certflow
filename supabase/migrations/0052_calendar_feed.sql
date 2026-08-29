-- The inspection diary as a calendar subscription.
--
-- A phone's calendar app cannot log in. It fetches one URL, forever, with
-- no session and no cookie — so the URL itself has to be the credential.
-- Each certifier gets an unguessable token; the feed it addresses shows
-- that certifier's firm's inspections and nothing else.
--
-- Safe to run twice.

alter table certifiers add column if not exists calendar_token uuid not null default gen_random_uuid();

-- Unique, because the token is what identifies the certifier when the
-- feed is fetched. Two certifiers sharing one would be one certifier
-- seeing the other's diary.
create unique index if not exists certifiers_calendar_token_key on certifiers(calendar_token);

-- Reading the feed happens with no signed-in user at all, so the route
-- looks the token up through this rather than through the table: it
-- answers with one firm id and nothing else, and it cannot be used to
-- read a name, an email, or any other certifier's token.
create or replace function certifier_for_calendar_token(p_token uuid)
returns table (certifier_id uuid, firm_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select id, firm_id, name from certifiers where calendar_token = p_token
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
  update certifiers
     set calendar_token = gen_random_uuid()
   where id = p_certifier_id
     and firm_id = current_firm_id()
  returning calendar_token into fresh;
  return fresh;
end;
$$;
