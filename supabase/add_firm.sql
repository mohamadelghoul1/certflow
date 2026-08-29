-- ============================================================================
-- CertFlow — add another firm
--
-- Everything a new firm needs, in one run: the firm, its first certifier,
-- the login that gets them in, and a document library to start from.
--
-- BEFORE running this, create their login:
--   Supabase -> Authentication -> Users -> Add user -> Create new user
--   Enter their email and a password, leave "Auto Confirm User" on,
--   then click the new user and copy their User UID.
--
-- Then fill in the seven values below and press Run. Nothing to copy
-- between steps, and no ids to paste from one query into the next.
--
-- Running it twice for the same email does nothing the second time
-- rather than creating a duplicate firm.
-- ============================================================================

do $$
declare
  -- ---- FILL THESE IN -------------------------------------------------
  v_auth_user_id   uuid := '<PASTE THE USER UID HERE>';
  v_firm_name      text := 'Their Firm Pty Ltd';
  v_firm_email     text := 'info@theirfirm.com.au';
  v_firm_phone     text := '02 0000 0000';
  v_certifier_name text := 'Their Certifier';
  v_registration   text := 'BDC0000';
  v_reg_body       text := 'Building Commission NSW';
  -- --------------------------------------------------------------------

  v_firm_id      uuid;
  v_certifier_id uuid;
  v_template     uuid;
  v_library      int;
begin
  if v_auth_user_id is null then
    raise exception 'Paste the User UID from Authentication -> Users into v_auth_user_id first.';
  end if;

  -- Already set up: say so and stop, rather than giving one person two
  -- firms and a login that could belong to either.
  if exists (select 1 from profiles where id = v_auth_user_id) then
    raise exception 'That login is already attached to a firm. Nothing has been changed.';
  end if;

  insert into firms (name, email, phone)
  values (v_firm_name, v_firm_email, v_firm_phone)
  returning id into v_firm_id;

  insert into certifiers (firm_id, name, registration_no, registration_body)
  values (v_firm_id, v_certifier_name, v_registration, v_reg_body)
  returning id into v_certifier_id;

  insert into profiles (id, firm_id, role, certifier_id, full_name, email)
  values (v_auth_user_id, v_firm_id, 'certifier', v_certifier_id, v_certifier_name, v_firm_email);

  -- The document library.
  --
  -- This is the step the old instructions left out, and the reason a new
  -- firm looked broken: the standard library is seeded by a migration,
  -- which only ever ran for the firms that existed at the time. A firm
  -- created afterwards had none at all, so every CDC, NOC and OC
  -- checklist on every new project came out empty with nothing to say
  -- why.
  --
  -- Copied from the firm that has the fullest library rather than from a
  -- list repeated here, so a new firm starts from one that is known to
  -- work. Their own blank forms are not copied — those are files
  -- belonging to another firm, and each firm attaches its own.
  select firm_id into v_template
    from document_library_items
   group by firm_id
   order by count(*) desc
   limit 1;

  if v_template is null then
    raise warning 'No firm has a document library to copy, so this one starts empty. Add items under Settings -> Document library.';
  else
    insert into document_library_items (firm_id, pathway, title, description, category, sort_order)
    select v_firm_id, pathway, title, description, category, sort_order
      from document_library_items
     where firm_id = v_template;
    get diagnostics v_library = row_count;
  end if;

  raise notice 'Firm "%" created with % document library items. They can sign in now.', v_firm_name, coalesce(v_library, 0);
end $$;
