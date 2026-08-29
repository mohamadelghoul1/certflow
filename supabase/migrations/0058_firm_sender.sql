-- Each firm sends from its own address.
--
-- The sending address was one setting for the whole deployment, which is
-- right for one firm and wrong the moment there are two: a second firm's
-- clients would receive their certificates and invoices apparently from
-- the first firm, and every reply would land in the first firm's inbox.
--
-- Left blank, a firm falls back to the deployment's address exactly as
-- before, so nothing changes for a firm that never fills these in.
--
-- The address must belong to a domain verified with the email provider
-- (Resend -> Domains). An unverified one is refused at send time, which
-- is why the Settings field says so rather than letting a firm discover
-- it when a certificate fails to reach a client.
--
-- Safe to run twice.

alter table firms
  add column if not exists from_email text,
  add column if not exists reply_to_email text;

comment on column firms.from_email is
  'Who this firm''s emails come from, as "Name <address@domain>". Blank uses the deployment default. The domain must be verified with the email provider.';
comment on column firms.reply_to_email is
  'Where replies to this firm''s emails go. Blank sends them to the from address.';
