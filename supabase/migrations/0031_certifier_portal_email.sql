-- The email each certifier signs into the NSW Planning Portal with.
--
-- The Portal records every API submission against a registered Portal
-- user, and refuses one from an address it does not know — and a
-- certifier's Portal login is not necessarily their Certlyn login.
-- Recorded once here, offered automatically every time an inspection is
-- reported.

alter table certifiers
  add column if not exists portal_email text;
