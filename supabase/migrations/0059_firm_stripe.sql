-- Each firm's own Stripe account.
--
-- Card payments used to be one Stripe account for the whole deployment:
-- whoever's key sat in Vercel received every firm's money. That is right
-- for one firm and indefensible the moment there are two — a second
-- firm's client would press "Pay online" and their payment would land in
-- the first firm's bank account.
--
-- The credentials live here rather than on `firms` on purpose. The
-- Settings page reads the whole firms row and hands it to a Client
-- Component, which means every column on `firms` is serialised into the
-- page and readable in the browser. A Stripe secret key on that table
-- would be a published secret.
--
-- So: no read policy at all. Nothing holding a user's login can select
-- from this table — not a client, not a certifier, not the firm that
-- owns the row. The server reads it with the service-role key, which
-- never leaves the server; the certifier writes through the two
-- functions below and can ask whether a key is set, but can never read
-- one back. A leak needs the service-role key, and anyone holding that
-- already has the whole database.
--
-- Safe to run twice.

create table if not exists firm_payment_credentials (
  firm_id uuid primary key references firms(id) on delete cascade,
  stripe_secret_key text,
  stripe_webhook_secret text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table firm_payment_credentials enable row level security;

-- Deliberately no policies. RLS with no policy denies everything to
-- every ordinary role; the service role bypasses RLS and is the only
-- reader.
drop policy if exists "certifier manage own firm payment credentials" on firm_payment_credentials;

-- Saving. A blank field means "leave what is stored alone", so a
-- certifier can set the webhook secret a week after the key without
-- retyping the key, and re-saving the page never wipes either.
create or replace function set_firm_stripe_credentials(p_secret_key text, p_webhook_secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm uuid;
begin
  if current_app_role() <> 'certifier' then
    raise exception 'only a certifier may change payment credentials';
  end if;
  v_firm := current_firm_id();
  if v_firm is null then
    raise exception 'no firm for this login';
  end if;

  insert into firm_payment_credentials (firm_id, stripe_secret_key, stripe_webhook_secret, updated_at, updated_by)
  values (v_firm, nullif(btrim(p_secret_key), ''), nullif(btrim(p_webhook_secret), ''), now(), auth.uid())
  on conflict (firm_id) do update set
    stripe_secret_key = coalesce(nullif(btrim(p_secret_key), ''), firm_payment_credentials.stripe_secret_key),
    stripe_webhook_secret = coalesce(nullif(btrim(p_webhook_secret), ''), firm_payment_credentials.stripe_webhook_secret),
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

grant execute on function set_firm_stripe_credentials(text, text) to authenticated;

-- Disconnecting. Clears both halves together: a webhook secret without a
-- key signs nothing, and a key without a webhook secret takes payments
-- Certlyn will never hear about.
create or replace function clear_firm_stripe_credentials()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm uuid;
begin
  if current_app_role() <> 'certifier' then
    raise exception 'only a certifier may change payment credentials';
  end if;
  v_firm := current_firm_id();
  if v_firm is null then
    raise exception 'no firm for this login';
  end if;
  delete from firm_payment_credentials where firm_id = v_firm;
end;
$$;

grant execute on function clear_firm_stripe_credentials() to authenticated;

-- What Settings shows: whether each half is set, and when it last
-- changed. Booleans only — the values themselves are never returned to
-- anything holding a login.
create or replace function firm_stripe_status()
returns table (secret_key_set boolean, webhook_secret_set boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.stripe_secret_key is not null,
    c.stripe_webhook_secret is not null,
    c.updated_at
  from firm_payment_credentials c
  where c.firm_id = current_firm_id()
    and current_app_role() = 'certifier';
$$;

grant execute on function firm_stripe_status() to authenticated;
