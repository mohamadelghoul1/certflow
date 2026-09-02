-- Which firm runs Certlyn.
--
-- The Storage page reports against the Supabase plan the whole
-- deployment sits on. That is the platform owner's business, not a
-- tenant firm's: a second firm should see its own projects, not the
-- size of someone else's plan or how much of it is used. One flag on
-- firms, set on the firm that was here first.

alter table firms add column if not exists platform_owner boolean not null default false;

update firms set platform_owner = true
where id = (select id from firms order by created_at limit 1)
  and not exists (select 1 from firms where platform_owner);

-- Shown back so the result can be checked: exactly one row should say
-- true, and it should be yours.
select name, platform_owner, created_at from firms order by created_at;
