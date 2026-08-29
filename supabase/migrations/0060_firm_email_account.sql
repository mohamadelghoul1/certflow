-- Each firm's own email account.
--
-- Migration 0058 let a firm set the address its mail goes out from. That
-- is only half of it: the mail itself was still sent through one Resend
-- account — this deployment's — and Resend will only send from a domain
-- verified in the account whose key is used. So a second firm could type
-- its own address and watch every email fail, or leave it blank and have
-- its clients receive certificates and invoices apparently from the
-- first firm.
--
-- With its own key, a firm signs up to Resend itself, verifies its own
-- domain, pastes the key here, and its mail leaves its own account under
-- its own name. Nothing to do at this end, and nothing of one firm on
-- another firm's email.
--
-- Stored the same way as the Stripe keys in 0059, and for the same
-- reason: the Settings page hands the whole firms row to the browser, so
-- a key on that table would be a published secret. This table has no
-- read policy at all — the server reads it with the service-role key,
-- and a certifier writes through the functions below and can only ever
-- be told whether a key is set.
--
-- Safe to run twice.

create table if not exists firm_email_credentials (
  firm_id uuid primary key references firms(id) on delete cascade,
  resend_api_key text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table firm_email_credentials enable row level security;

-- Deliberately no policies: RLS with no policy denies every ordinary
-- role, and the service role bypasses RLS and is the only reader.
drop policy if exists "certifier manage own firm email credentials" on firm_email_credentials;

create or replace function set_firm_email_api_key(p_api_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm uuid;
begin
  if current_app_role() <> 'certifier' then
    raise exception 'only a certifier may change the email account';
  end if;
  v_firm := current_firm_id();
  if v_firm is null then
    raise exception 'no firm for this login';
  end if;
  if nullif(btrim(p_api_key), '') is null then
    raise exception 'no key given';
  end if;

  insert into firm_email_credentials (firm_id, resend_api_key, updated_at, updated_by)
  values (v_firm, btrim(p_api_key), now(), auth.uid())
  on conflict (firm_id) do update set
    resend_api_key = btrim(p_api_key),
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

grant execute on function set_firm_email_api_key(text) to authenticated;

create or replace function clear_firm_email_api_key()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm uuid;
begin
  if current_app_role() <> 'certifier' then
    raise exception 'only a certifier may change the email account';
  end if;
  v_firm := current_firm_id();
  if v_firm is null then
    raise exception 'no firm for this login';
  end if;
  delete from firm_email_credentials where firm_id = v_firm;
end;
$$;

grant execute on function clear_firm_email_api_key() to authenticated;

-- What Settings is allowed to know: that a key is set, and when it last
-- changed. Never the key.
create or replace function firm_email_status()
returns table (api_key_set boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.resend_api_key is not null, c.updated_at
  from firm_email_credentials c
  where c.firm_id = current_firm_id()
    and current_app_role() = 'certifier';
$$;

grant execute on function firm_email_status() to authenticated;
