-- ============================================================================
-- Certlyn — the demonstration account
--
-- A firm that exists only to be shown to other certifiers. It has
-- nothing to do with Quality Private Certifiers: its own name, its own
-- certifier, its own made-up clients and projects, walled off from every
-- real firm by the same row security that separates any two firms.
--
-- It is marked as a demonstration (migration 0075), which means Certlyn
-- refuses to send email from it. Every "client" address below is on
-- example.com, a domain the standards reserve so that it can never
-- belong to anyone — belt and braces.
--
-- BEFORE running this, create the login:
--   Supabase -> Authentication -> Users -> Add user -> Create new user
--   Use an address you control, e.g. demo@certlyn.com.au, leave
--   "Auto Confirm User" on, then click the new user and copy their UID.
--
-- Paste that UID below and press Run.
--
-- SAFE TO RUN AGAIN. A second run wipes this demo firm's projects,
-- clients, quotes and invoices and lays them out fresh — which is how
-- you reset the account after a demonstration where you issued a
-- certificate or ticked off a checklist.
-- ============================================================================

do $$
declare
  -- ---- FILL THIS IN --------------------------------------------------
  v_auth_user_typed text := '<PASTE THE USER UID HERE>';
  -- --------------------------------------------------------------------

  -- Deliberately a name no NSW certifier trades under, so nobody can
  -- mistake the demonstration for a real practice.
  v_firm_name      constant text := 'Certlyn Demonstration Certifiers';
  v_certifier_name constant text := 'Alex Demo';

  v_auth_user_id uuid;
  v_firm_id      uuid;
  v_certifier_id uuid;
  v_template     uuid;
  v_owner        uuid;
  v_client_owner uuid;
  v_client_build uuid;
  v_client_arch  uuid;
  v_job_cdc      uuid;
  v_job_cc       uuid;
  v_job_site     uuid;
  v_job_oc       uuid;
  v_job_pcoc     uuid;
  v_quote        uuid;
  v_invoice      uuid;
  v_version      uuid;
  v_library      int;
begin
  v_auth_user_typed := btrim(coalesce(v_auth_user_typed, ''));
  if v_auth_user_typed !~ '^[0-9a-fA-F-]{36}$' then
    raise exception E'Scroll to the TOP of this script and paste the demonstration login''s User UID.\n\nIt comes from Supabase -> Authentication -> Users: click the user you made for the demo and copy their UID. It looks like a1b2c3d4-5e6f-7890-abcd-ef1234567890.\n\nNothing has been created.';
  end if;
  v_auth_user_id := v_auth_user_typed::uuid;

  if not exists (select 1 from auth.users where id = v_auth_user_id) then
    raise exception 'No login with that UID exists. Create it under Authentication -> Users first. Nothing has been created.';
  end if;

  -- An existing demo firm is refilled rather than duplicated. A login
  -- already attached to a *real* firm is refused outright: this script
  -- deletes projects, and it will not do that to anybody's live work.
  select firm_id into v_firm_id from profiles where id = v_auth_user_id;
  if v_firm_id is not null and not exists (select 1 from firms where id = v_firm_id and demo) then
    raise exception 'That login already belongs to a firm that is not a demonstration account. Nothing has been changed — use a login of its own for the demo.';
  end if;

  if v_firm_id is null then
    insert into firms (name, email, phone, abn, office_address, postal_address, website, demo)
    values (v_firm_name, 'hello@example.com', '02 0000 0000', '00 000 000 000',
            'Suite 1, 100 Sample Street, Parramatta NSW 2150', 'PO Box 100, Parramatta NSW 2150',
            'www.example.com', true)
    returning id into v_firm_id;
  else
    update firms set name = v_firm_name, demo = true where id = v_firm_id;
  end if;

  -- Everything this firm holds, cleared. Jobs cascade to their
  -- checklists, documents, inspections and certificates.
  delete from jobs where firm_id = v_firm_id;
  delete from invoices where firm_id = v_firm_id;
  delete from quotes where firm_id = v_firm_id;
  delete from clients where firm_id = v_firm_id;

  select id into v_certifier_id from certifiers where firm_id = v_firm_id order by created_at limit 1;
  if v_certifier_id is null then
    insert into certifiers (firm_id, name, registration_no, registration_body, email, mobile, pi_insurance_expiry, registration_expiry, firm_role)
    values (v_firm_id, v_certifier_name, 'BDC0000', 'Building Commission NSW', 'alex@example.com', '0400 000 000',
            current_date + 300, current_date + 400, 'director')
    returning id into v_certifier_id;
  else
    update certifiers set name = v_certifier_name, firm_role = 'director' where id = v_certifier_id;
  end if;

  if not exists (select 1 from profiles where id = v_auth_user_id) then
    insert into profiles (id, firm_id, role, certifier_id, full_name, email)
    values (v_auth_user_id, v_firm_id, 'certifier', v_certifier_id, v_certifier_name, (select email from auth.users where id = v_auth_user_id));
  else
    update profiles set firm_id = v_firm_id, certifier_id = v_certifier_id, full_name = v_certifier_name where id = v_auth_user_id;
  end if;

  -- A second certifier, so the roles and the per-project team have
  -- somebody to demonstrate on.
  if not exists (select 1 from certifiers where firm_id = v_firm_id and firm_role <> 'director') then
    insert into certifiers (firm_id, name, registration_no, registration_body, email, firm_role)
    values (v_firm_id, 'Sam Sample', 'BDC0001', 'Building Commission NSW', 'sam@example.com', 'staff');
  end if;

  -- The document library, copied from the firm that runs Certlyn (or
  -- whoever has the fullest one) exactly as a new firm's is, so the
  -- checklists in the demonstration are the ones a real firm gets.
  if not exists (select 1 from document_library_items where firm_id = v_firm_id) then
    select f.id into v_template from firms f join document_library_items d on d.firm_id = f.id
     where f.platform_owner group by f.id limit 1;
    if v_template is null then
      select firm_id into v_template from document_library_items where firm_id <> v_firm_id group by firm_id order by count(*) desc limit 1;
    end if;
    if v_template is null then
      raise warning 'No firm has a document library to copy, so the demo checklists will be empty.';
    else
      insert into document_library_items (firm_id, pathway, title, description, category, sort_order)
      select v_firm_id, pathway, title, description, category, sort_order from document_library_items where firm_id = v_template;
      get diagnostics v_library = row_count;
    end if;
  end if;

  -- ---- The people ----------------------------------------------------
  insert into clients (firm_id, name, type, company, email, phone)
  values (v_firm_id, 'Jordan Taylor', 'Owner', null, 'jordan.taylor@example.com', '0400 111 111')
  returning id into v_client_owner;
  insert into clients (firm_id, name, type, company, email, phone)
  values (v_firm_id, 'Casey Nguyen', 'Builder', 'Sample Constructions Pty Ltd', 'casey@example.com', '0400 222 222')
  returning id into v_client_build;
  insert into clients (firm_id, name, type, company, email, phone)
  values (v_firm_id, 'Robin Hall', 'Architect', 'Sample Architects', 'robin@example.com', '0400 333 333')
  returning id into v_client_arch;

  -- ---- Five projects, one at each point in the work -------------------
  -- 1. A CDC still collecting documents.
  insert into jobs (firm_id, address, description, pathway, status, assigned_certifier_id, client_id, job_types, details)
  values (v_firm_id, '14 Sample Street, Parramatta NSW 2150', 'New two-storey dwelling', 'CDC', 'active', v_certifier_id, v_client_owner,
          to_jsonb(array['New dwelling']),
          jsonb_build_object(
            'projectNumber', 'DEMO-001',
            'contact', jsonb_build_object('nameOrCompany', 'Jordan Taylor', 'email', 'jordan.taylor@example.com', 'phone', '0400 111 111'),
            'land', jsonb_build_object('lotSectionDp', 'Lot 12 DP 123456', 'councilLga', 'City of Parramatta', 'zoning', 'R2 Low Density Residential')))
  returning id into v_job_cdc;

  -- 2. A CDC ready to issue: everything approved, Portal reference in.
  insert into jobs (firm_id, address, description, pathway, status, assigned_certifier_id, client_id, job_types, details)
  values (v_firm_id, '27 Example Avenue, Blacktown NSW 2148', 'Secondary dwelling (granny flat)', 'CDC', 'active', v_certifier_id, v_client_arch,
          to_jsonb(array['Secondary dwelling']),
          jsonb_build_object(
            'projectNumber', 'DEMO-002',
            'contact', jsonb_build_object('nameOrCompany', 'Sample Architects', 'email', 'robin@example.com'),
            'land', jsonb_build_object('lotSectionDp', 'Lot 3 DP 234567', 'councilLga', 'Blacktown City Council', 'zoning', 'R2 Low Density Residential'),
            'certificateDetails', jsonb_build_object('planningPortalRef', 'CDC-2026-000123')))
  returning id into v_job_cc;

  -- 3. Under construction: certificate issued, inspections part done.
  insert into jobs (firm_id, address, description, pathway, status, assigned_certifier_id, client_id, job_types, details,
                    pathway_generated, pathway_generated_date, pathway_issued_by, pathway_version, pathway_signed_at, pathway_sent_to_client, pathway_sent_to_client_date)
  values (v_firm_id, '5 Demonstration Close, Penrith NSW 2750', 'Alterations and additions', 'CDC', 'active', v_certifier_id, v_client_build,
          to_jsonb(array['Alterations and additions']),
          jsonb_build_object(
            'projectNumber', 'DEMO-003',
            'contact', jsonb_build_object('nameOrCompany', 'Sample Constructions Pty Ltd', 'email', 'casey@example.com'),
            'land', jsonb_build_object('lotSectionDp', 'Lot 8 DP 345678', 'councilLga', 'Penrith City Council', 'zoning', 'R2 Low Density Residential'),
            'certificateDetails', jsonb_build_object('planningPortalRef', 'CDC-2026-000091', 'determinationDate', to_char(current_date - 70, 'YYYY-MM-DD')),
            'inspectionPortalCase', 'CDC-2026-000091'),
          true, current_date - 70, v_certifier_id, 1, (now() - interval '70 days'), true, current_date - 69)
  returning id into v_job_site;

  -- 4. Finished: certificate and Occupation Certificate both issued.
  insert into jobs (firm_id, address, description, pathway, status, assigned_certifier_id, client_id, job_types, details,
                    pathway_generated, pathway_generated_date, pathway_issued_by, pathway_version, pathway_signed_at, pathway_sent_to_client, pathway_sent_to_client_date)
  values (v_firm_id, '9 Sample Parade, Liverpool NSW 2170', 'New dwelling', 'CC', 'complete', v_certifier_id, v_client_owner,
          to_jsonb(array['New dwelling']),
          jsonb_build_object(
            'projectNumber', 'DEMO-004',
            'contact', jsonb_build_object('nameOrCompany', 'Jordan Taylor', 'email', 'jordan.taylor@example.com'),
            'land', jsonb_build_object('lotSectionDp', 'Lot 22 DP 456789', 'councilLga', 'Liverpool City Council', 'zoning', 'R3 Medium Density Residential'),
            'certificateDetails', jsonb_build_object('planningPortalRef', 'CC-2025-000410', 'determinationDate', to_char(current_date - 300, 'YYYY-MM-DD'))),
          true, current_date - 300, v_certifier_id, 1, (now() - interval '300 days'), true, current_date - 299)
  returning id into v_job_oc;

  -- 5. Somebody else's approval, this firm doing the PC and OC.
  insert into jobs (firm_id, address, description, pathway, status, assigned_certifier_id, client_id, job_types, details)
  values (v_firm_id, '31 Example Road, Campbelltown NSW 2560', 'Dual occupancy — PC and OC only', 'PC_OC', 'active', v_certifier_id, v_client_build,
          to_jsonb(array['Dual occupancy']),
          jsonb_build_object(
            'projectNumber', 'DEMO-005',
            'contact', jsonb_build_object('nameOrCompany', 'Sample Constructions Pty Ltd', 'email', 'casey@example.com'),
            'land', jsonb_build_object('lotSectionDp', 'Lot 5 DP 567890', 'councilLga', 'Campbelltown City Council'),
            'priorApproval', jsonb_build_object('number', 'DA-2025-0456', 'portalRef', 'PAN-123456', 'issuedBy', 'Another Certifier', 'date', to_char(current_date - 120, 'YYYY-MM-DD'))))
  returning id into v_job_pcoc;

  -- ---- Checklists, from the firm's own library -----------------------
  insert into checklists (job_id, kind)
  select j.id, k.kind
    from (values (v_job_cdc), (v_job_cc), (v_job_site), (v_job_oc), (v_job_pcoc)) as j(id)
   cross join (values ('pathway'), ('noc'), ('oc')) as k(kind);

  insert into checklist_items (checklist_id, title, description, category, sort_order, template_library_item_id)
  select c.id, d.title, d.description, d.category, d.sort_order, d.id
    from checklists c
    join jobs j on j.id = c.job_id
    join document_library_items d
      on d.firm_id = v_firm_id
     and d.pathway = case c.kind when 'pathway' then j.pathway when 'noc' then 'NOC' else 'OC' end
   where j.firm_id = v_firm_id;

  -- Project 1 is part way through: some approved, one still to come.
  update checklist_items set status = 'approved'
   where checklist_id in (select id from checklists where job_id = v_job_cdc and kind = 'pathway')
     and sort_order < 3;
  update checklist_items set status = 'submitted'
   where checklist_id in (select id from checklists where job_id = v_job_cdc and kind = 'pathway')
     and sort_order = 3;

  -- Projects 2, 3 and 4 have their assessment finished.
  update checklist_items set status = 'approved'
   where checklist_id in (select id from checklists where job_id in (v_job_cc, v_job_site, v_job_oc) and kind = 'pathway');
  update checklist_items set status = 'approved'
   where checklist_id in (select id from checklists where job_id in (v_job_site, v_job_oc) and kind = 'noc');
  update checklist_items set status = 'approved'
   where checklist_id in (select id from checklists where job_id = v_job_oc and kind = 'oc');

  -- ---- The certificates already issued -------------------------------
  insert into pathway_certificate_versions (job_id, version, generated_date, issued_by, visible_to_client, signed_at, sent_to_client, sent_to_client_date, cert_ref)
  values (v_job_site, 1, current_date - 70, v_certifier_id, true, now() - interval '70 days', true, current_date - 69, 'CDC-26003/01')
  returning id into v_version;
  insert into pathway_certificate_versions (job_id, version, generated_date, issued_by, visible_to_client, signed_at, sent_to_client, sent_to_client_date, cert_ref)
  values (v_job_oc, 1, current_date - 300, v_certifier_id, true, now() - interval '300 days', true, current_date - 299, 'CC-25004/01');

  insert into oc_records (job_id, type, description, generated_date, issued_by, signed_at, sent_to_client, sent_to_client_date, cert_ref, portal_ref)
  values (v_job_oc, 'whole', 'New dwelling', current_date - 20, v_certifier_id, now() - interval '20 days', true, current_date - 19, 'OC-25004/01', 'OC-2026-000077');

  -- ---- Inspections ---------------------------------------------------
  insert into inspections (job_id, title, description, inspector_certifier_id, sort_order)
  select j.id, i.title, i.descr, v_certifier_id, i.ord
    from (values (v_job_cdc), (v_job_cc), (v_job_site), (v_job_oc), (v_job_pcoc)) as j(id)
   cross join (values
      ('Piers', 'Inspection of piers prior to pour.', 0),
      ('Footings and Slab', 'Inspection of footings and slab reinforcement prior to pour.', 1),
      ('Frame', 'Inspection of structural frame prior to lock-up.', 2),
      ('Wet Area Waterproofing', 'Inspection of wet area waterproofing.', 3),
      ('Stormwater', 'Inspection of stormwater drainage installation.', 4),
      ('Final', 'Final inspection prior to occupation.', 5)
   ) as i(title, descr, ord);

  -- Project 3 is mid-build: three done, the next one booked for tomorrow
  -- so the dashboard and the On site screen both have something to show.
  update inspections set outcome = 'passed', date = current_date - 60, report_signed_at = now() - interval '60 days', portal_reported = true, portal_reported_date = current_date - 59
   where job_id = v_job_site and sort_order <= 1;
  update inspections set outcome = 'passed', date = current_date - 30, report_signed_at = now() - interval '30 days', portal_reported = true, portal_reported_date = current_date - 29
   where job_id = v_job_site and sort_order = 2;
  update inspections set date = current_date + 1, confirmed = true where job_id = v_job_site and sort_order = 3;
  -- A client-requested booking waiting on the certifier to confirm —
  -- the "needs your attention" tile has to have something in it.
  update inspections set date = current_date + 3, booked_by_client = true, confirmed = false where job_id = v_job_site and sort_order = 4;
  -- Project 4 is finished, so every inspection on it is done.
  update inspections set outcome = 'passed', date = current_date - 40, report_signed_at = now() - interval '40 days', portal_reported = true, portal_reported_date = current_date - 39
   where job_id = v_job_oc;

  -- ---- A quote and two invoices --------------------------------------
  insert into quotes (firm_id, state, project_type, pathway, proposal_address, project_title, certifier_id, client_id,
                      development_description, council_lga, status, quote_number, lot_section_plan)
  values (v_firm_id, 'NSW', 'Residential', 'CDC', '48 Example Terrace, Ryde NSW 2112', 'Proposed new dwelling', v_certifier_id, v_client_arch,
          'Construction of a new two-storey dwelling with attached garage.', 'City of Ryde', 'sent', 'Q-DEMO-001', 'Lot 7 DP 678901')
  returning id into v_quote;
  insert into quote_fee_lines (quote_id, description, quantity, amount, sort_order) values
    (v_quote, 'Complying Development Certificate', 1, 2850, 0),
    (v_quote, 'Critical stage inspections (6)', 1, 1650, 1),
    (v_quote, 'Occupation Certificate', 1, 850, 2);

  insert into invoices (firm_id, job_id, client_id, invoice_number, status, issue_date, due_date, bill_to, reference)
  values (v_firm_id, v_job_site, v_client_build, 'INV-DEMO-001', 'sent', current_date - 40, current_date - 12,
          'Sample Constructions Pty Ltd', '5 Demonstration Close, Penrith')
  returning id into v_invoice;
  insert into invoice_lines (invoice_id, description, quantity, amount, sort_order) values
    (v_invoice, 'Complying Development Certificate', 1, 2650, 0),
    (v_invoice, 'Critical stage inspections', 1, 1450, 1);

  insert into invoices (firm_id, job_id, client_id, invoice_number, status, issue_date, due_date, paid_date, bill_to, reference)
  values (v_firm_id, v_job_oc, v_client_owner, 'INV-DEMO-002', 'paid', current_date - 250, current_date - 236, current_date - 240,
          'Jordan Taylor', '9 Sample Parade, Liverpool')
  returning id into v_invoice;
  insert into invoice_lines (invoice_id, description, quantity, amount, sort_order) values
    (v_invoice, 'Construction Certificate', 1, 3200, 0),
    (v_invoice, 'Occupation Certificate', 1, 850, 1);

  raise notice 'Demonstration firm "%" is ready: 5 projects, 3 clients, 1 quote, 2 invoices, % library items. Sign in with the login you used above.',
    v_firm_name, coalesce(v_library, (select count(*) from document_library_items where firm_id = v_firm_id));
end $$;
