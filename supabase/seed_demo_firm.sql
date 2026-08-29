-- =============================================================================
-- Certlyn demo firm — realistic fictional data for screenshots and videos
-- =============================================================================
--
-- Creates a SECOND, completely separate firm alongside your real one, so
-- nothing here can touch or be seen from your live jobs: Row Level
-- Security keeps each firm to its own data, and you switch between them
-- by logging in as a different user.
--
-- Everything below is invented. Phone numbers come from the ACMA ranges
-- reserved for fiction (02 5550 xxxx, 0491 570 xxx) and email addresses
-- use example.com, which exists for documentation and can never belong to
-- a real person — so a screenshot can go anywhere without exposing a
-- client or dialling a stranger.
--
-- BEFORE RUNNING
--   1. In Supabase, open Authentication -> Users -> Add user.
--      Email: demo@example.com   (or anything you like)
--      Password: pick one you'll remember, and tick "Auto Confirm User".
--   2. Copy the new user's UUID.
--   3. Paste it over <AUTH_USER_ID> on the line marked below.
--   4. Run the whole script.
--
-- Dates are all relative to the day you run it, so the demo still looks
-- current months from now. Re-run it any time for a fresh copy — but note
-- that re-running ADDS a second demo firm rather than replacing the first;
-- the cleanup line at the very bottom of this file removes the old one.
-- =============================================================================

do $$
declare
  -- ⬇⬇⬇  PASTE THE AUTH USER ID FROM STEP 2 HERE  ⬇⬇⬇
  v_auth_user_text text := '<AUTH_USER_ID>';

  v_auth_user uuid;

  v_firm uuid := gen_random_uuid();
  v_cert_principal uuid := gen_random_uuid();
  v_cert_second uuid := gen_random_uuid();

  v_client_architect uuid := gen_random_uuid();
  v_client_builder uuid := gen_random_uuid();
  v_client_owner uuid := gen_random_uuid();

  v_job_a uuid := gen_random_uuid(); -- CDC, under construction
  v_job_b uuid := gen_random_uuid(); -- CDC, in assessment
  v_job_c uuid := gen_random_uuid(); -- CC, awaiting commencement
  v_job_d uuid := gen_random_uuid(); -- CDC, complete with OC
  v_job_e uuid := gen_random_uuid(); -- CDC, modified

  v_quote_draft uuid := gen_random_uuid();
  v_quote_sent uuid := gen_random_uuid();
  v_quote_accepted uuid := gen_random_uuid();

  v_checklist uuid;
  v_item uuid;
  v_mod uuid := gen_random_uuid();
  v_list uuid;

  -- The six mandatory critical stage inspections, as a new job stores them.
  v_csi jsonb := '[
    {"id":"1","stage":"After excavation for and prior to placement of any footings","inspector":"Registered Certifier & Structural Engineer","enabled":true},
    {"id":"2","stage":"Prior to pouring any in-situ reinforced concrete building element","inspector":"Registered Certifier & Structural Engineer","enabled":true},
    {"id":"3","stage":"Prior to covering of the framework for any floor, wall, roof, or other building element","inspector":"Registered Certifier & Structural Engineer","enabled":true},
    {"id":"4","stage":"Prior to covering waterproofing in any wet areas","inspector":"Registered Certifier","enabled":true},
    {"id":"5","stage":"Prior to covering any stormwater drainage connections","inspector":"Registered Certifier","enabled":true},
    {"id":"6","stage":"After the building work has been completed & prior to any Occupation Certificate being issued in relation to the building","inspector":"Principal Certifier","enabled":true}
  ]'::jsonb;
begin

-- Two friendly stops rather than a cryptic database error: the id has to
-- look like an id at all, and it has to belong to a login that exists.
if v_auth_user_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
  raise exception 'Paste the Supabase Auth user id over <AUTH_USER_ID> near the top of this file first (see step 2).';
end if;

v_auth_user := v_auth_user_text::uuid;

if not exists (select 1 from auth.users where id = v_auth_user) then
  raise exception 'No Supabase Auth user has the id %. Create the demo login under Authentication -> Users first (step 1), then paste ITS id.', v_auth_user;
end if;

-- ---------------------------------------------------------------------------
-- The firm, its certifiers, and the login that sees them
-- ---------------------------------------------------------------------------
insert into firms (id, name, abn, postal_address, office_address, phone, email, website)
values (
  v_firm,
  'Harbourview Certifiers',
  '12 345 678 901',
  'PO Box 2214, Parramatta NSW 2150',
  'Suite 12, Level 3, 45 Macquarie Street, Parramatta NSW 2150',
  '(02) 5550 0180',
  'info@example.com',
  'www.example.com'
);

insert into certifiers (id, firm_id, name, registration_no, registration_body) values
  (v_cert_principal, v_firm, 'Daniel Rowe',   'BDC1842', 'Building Commission NSW'),
  (v_cert_second,    v_firm, 'Priya Naidoo',  'BDC2317', 'Building Commission NSW');

insert into profiles (id, firm_id, role, certifier_id, full_name, email)
values (v_auth_user, v_firm, 'certifier', v_cert_principal, 'Daniel Rowe', 'demo@example.com');

-- ---------------------------------------------------------------------------
-- The document library this firm requests from applicants
-- ---------------------------------------------------------------------------
insert into document_library_items (firm_id, pathway, title, description, category, sort_order)
select v_firm, v.pathway, v.title, v.description, v.category, v.sort_order
from (values
  ('CDC', 'CDC Application Form', 'Complete and lodge the CDC application.', 'Other', 0),
  ('CDC', 'Site Plan', 'Site plan showing setbacks, boundaries and existing structures.', 'Architectural', 1),
  ('CDC', 'Architectural Plans', 'Full set of architectural plans and elevations.', 'Architectural', 2),
  ('CDC', 'BASIX Certificate', 'Valid BASIX certificate consistent with plans.', 'Other', 3),
  ('CDC', 'Shadow Diagrams', 'Shadow diagrams demonstrating overshadowing compliance.', 'Architectural', 4),
  ('CDC', 'Stormwater Concept Plan', 'Concept stormwater management plan.', 'Engineering', 5),
  ('CC', 'CC Application Form', 'Complete and lodge the CC application.', 'Other', 0),
  ('CC', 'Architectural Plans', 'Full set of architectural plans and elevations.', 'Architectural', 1),
  ('CC', 'Structural Engineering Details', 'Structural plans and computations.', 'Structural', 2),
  ('CC', 'BASIX Certificate', 'Valid BASIX certificate consistent with plans.', 'Other', 3),
  ('CC', 'Fire Safety Schedule', 'Schedule of fire safety measures (if applicable).', 'Other', 4),
  ('NOC', 'Notice of Commencement', 'Submit at least 2 days prior to works starting.', 'Other', 0),
  ('NOC', 'Appointment of PCA', 'Formal appointment of the Principal Certifying Authority.', 'Other', 1),
  ('NOC', 'Long Service Levy Receipt', 'Evidence of payment of the Long Service Levy.', 'Other', 2),
  ('NOC', 'Home Building Compensation Certificate', 'Insurance certificate for works over $20,000.', 'Other', 3),
  ('OC', 'OC Application Form', 'Complete and submit the OC Application Form.', 'Other', 0),
  ('OC', 'BASIX Completion Receipt', 'Obtained on completion of works.', 'Other', 1),
  ('OC', 'Works as Executed Stormwater Plan', 'Prepared by a registered surveyor, approved by a civil engineer.', 'Engineering', 2),
  ('OC', 'Section 73 Compliance Certificate', 'Sydney Water compliance certificate for completed works.', 'Other', 3),
  ('OC', 'Final Survey', 'Survey confirming RLs, ridgelines and setbacks.', 'Other', 4),
  ('OC', 'Termite Protection Certificate', 'Certification per AS3660.1-2000 and BCA Clause B1.4.', 'Other', 5),
  ('OC', 'Landscaping Certification', 'Certification that landscape works meet approved plans.', 'Other', 6),
  ('OC', 'Smoke Alarm Compliance', 'Certification of smoke alarm installation.', 'Other', 7)
) as v(pathway, title, description, category, sort_order);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
insert into clients (id, firm_id, name, type, company, email, phone) values
  (v_client_architect, v_firm, 'Elena Marsh',   'Architect', 'Studio North Architects', 'elena.marsh@example.com',  '(02) 5550 0231'),
  (v_client_builder,   v_firm, 'Tom Whelan',    'Builder',   'Meridian Build Group',    'tom.whelan@example.com',   '0491 570 118'),
  (v_client_owner,     v_firm, 'Sarah Nguyen',  'Owner',     null,                       'sarah.nguyen@example.com', '0491 570 246');

-- ---------------------------------------------------------------------------
-- Job A — CDC issued, works underway, inspections in progress
-- ---------------------------------------------------------------------------
insert into jobs (
  id, firm_id, address, description, job_types, pathway, assigned_certifier_id, status, client_id,
  details, critical_stage_inspections,
  pathway_generated, pathway_generated_date, pathway_issued_by, pathway_version,
  pathway_approval_uploaded, pathway_approval_date, created_at
) values (
  v_job_a, v_firm,
  '24 Wentworth Avenue, Kingsgrove NSW 2208',
  'Construction of a new two-storey dwelling with attached garage, swimming pool and associated site works.',
  '["New Dwelling","Pool"]'::jsonb, 'CDC', v_cert_principal, 'active', v_client_builder,
  jsonb_build_object(
    'projectNumber', '26014',
    'zoning', 'R2 Low Density Residential',
    'bcaVersion', 'NCC 2022 Amendment 2', 'bcaVolumes', '["Volume Two"]'::jsonb,
    'contact', jsonb_build_object('nameOrCompany','Meridian Build Group','title','Mr','givenNames','Tom','surname','Whelan','phone','(02) 5550 0294','mobile','0491 570 118','email','tom.whelan@example.com'),
    'applicantAddress', jsonb_build_object('streetNumber','8','street','Cross Street','suburb','Hurstville','state','NSW','postcode','2220'),
    'ownerSameAsApplicant', false,
    'owner', jsonb_build_object('name','Sarah Nguyen & David Nguyen','phone','0491 570 246','address', jsonb_build_object('streetNumber','24','street','Wentworth Avenue','suburb','Kingsgrove','state','NSW','postcode','2208')),
    'council', jsonb_build_object('lga','Georges River Council','address', jsonb_build_object('streetNumber','','street','Civic Centre, MacMahon Street','suburb','Hurstville','state','NSW','postcode','2220'),'contact', jsonb_build_object('phone','(02) 5550 0900','email','council@example.com')),
    'proposal', jsonb_build_object('classifications','["1a","10a","10b"]'::jsonb,'constructionType','Type 3','dwellingsExisting','1','dwellingsDemolished','1','dwellingsNew','1','estimatedCost','985000','storeysAbove','2','storeysBelow','0','storeysTotal','2','effectiveHeight','6.8','floorAreaExisting','0','floorAreaNew','284.5'),
    'siteArea', '612',
    'certificateDetails', jsonb_build_object(
      'lotSectionDp','14/-/DP240918','planningPortalRef','CDC-2026-114208',
      'relevantInstrument','State Environmental Planning Policy (Exempt and Complying Development Codes) 2008',
      'relevantPartOfCode','Part 3 — Housing Code','codeParts','["Part 3 — Housing Code"]'::jsonb,
      'determinationDate', to_char(current_date - 40, 'YYYY-MM-DD'),
      'lapseDate', to_char(current_date + 1785, 'YYYY-MM-DD'))
  ),
  v_csi,
  true, current_date - 40, v_cert_principal, 1, true, current_date - 39, now() - interval '75 days'
);

insert into pathway_certificate_versions (job_id, version, generated_date, issued_by, approval_uploaded, approval_date)
values (v_job_a, 1, current_date - 40, v_cert_principal, true, current_date - 39);

insert into conditions_of_consent (job_id, text, date_added) values
  (v_job_a, 'All stormwater is to be discharged to the street gutter in accordance with the approved plans.', current_date - 40),
  (v_job_a, 'Erosion and sediment controls are to be installed prior to the commencement of any works.', current_date - 40);

-- Its three checklists, with the CDC set fully approved
insert into checklists (job_id, kind) values (v_job_a, 'pathway') returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, version, revision, document_date, prepared_by, drawing_number, requires_stamping, sort_order) values
  (v_checklist, 'CDC Application Form', 'Complete and lodge the CDC application.', 'Other', 'approved', 1, 'A', current_date - 62, 'Meridian Build Group', null, false, 0),
  (v_checklist, 'Site Plan', 'Site plan showing setbacks, boundaries and existing structures.', 'Architectural', 'approved', 2, 'B', current_date - 55, 'Studio North Architects', 'DA-01', true, 1),
  (v_checklist, 'Architectural Plans', 'Full set of architectural plans and elevations.', 'Architectural', 'approved', 3, 'C', current_date - 48, 'Studio North Architects', 'DA-02 to DA-09', true, 2),
  (v_checklist, 'BASIX Certificate', 'Valid BASIX certificate consistent with plans.', 'Other', 'approved', 1, 'A', current_date - 60, 'Efficient Homes Assessors', '1892456S', false, 3),
  (v_checklist, 'Shadow Diagrams', 'Shadow diagrams demonstrating overshadowing compliance.', 'Architectural', 'approved', 1, 'A', current_date - 55, 'Studio North Architects', 'DA-10', true, 4),
  (v_checklist, 'Stormwater Concept Plan', 'Concept stormwater management plan.', 'Engineering', 'approved', 2, 'B', current_date - 50, 'Calder Civil Engineering', 'SW-01', true, 5);

insert into checklists (job_id, kind) values (v_job_a, 'noc') returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, version, document_date, prepared_by, sort_order) values
  (v_checklist, 'Notice of Commencement', 'Submit at least 2 days prior to works starting.', 'Other', 'approved', 1, current_date - 34, 'Meridian Build Group', 0),
  (v_checklist, 'Appointment of PCA', 'Formal appointment of the Principal Certifying Authority.', 'Other', 'approved', 1, current_date - 36, 'Meridian Build Group', 1),
  (v_checklist, 'Long Service Levy Receipt', 'Evidence of payment of the Long Service Levy.', 'Other', 'approved', 1, current_date - 35, 'Meridian Build Group', 2),
  (v_checklist, 'Home Building Compensation Certificate', 'Insurance certificate for works over $20,000.', 'Other', 'approved', 1, current_date - 35, 'Meridian Build Group', 3);

insert into checklists (job_id, kind) values (v_job_a, 'oc') returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, sort_order) values
  (v_checklist, 'OC Application Form', 'Complete and submit the OC Application Form.', 'Other', 'requested', 0),
  (v_checklist, 'BASIX Completion Receipt', 'Obtained on completion of works.', 'Other', 'requested', 1),
  (v_checklist, 'Works as Executed Stormwater Plan', 'Prepared by a registered surveyor, approved by a civil engineer.', 'Engineering', 'requested', 2),
  (v_checklist, 'Section 73 Compliance Certificate', 'Sydney Water compliance certificate for completed works.', 'Other', 'requested', 3),
  (v_checklist, 'Final Survey', 'Survey confirming RLs, ridgelines and setbacks.', 'Other', 'requested', 4),
  (v_checklist, 'Termite Protection Certificate', 'Certification per AS3660.1-2000 and BCA Clause B1.4.', 'Other', 'requested', 5);

-- Inspections: three done, the frame booked for next week, the rest ahead
insert into inspections (job_id, title, description, date, outcome, inspector_certifier_id, report_sent, report_sent_date, confirmed, portal_reported, portal_reported_date) values
  (v_job_a, 'Prior to CC/CDC', 'Site inspection prior to issue of CC or CDC.', current_date - 44, 'passed', v_cert_principal, true, current_date - 43, true, true, current_date - 43),
  (v_job_a, 'Piers & Footings', 'Inspection of piers and footings prior to pour.', current_date - 26, 'passed', v_cert_principal, true, current_date - 25, true, true, current_date - 25),
  (v_job_a, 'Slab Steel', 'Inspection of slab reinforcement prior to pour.', current_date - 12, 'passed_subject_to', v_cert_principal, true, current_date - 11, true, true, current_date - 11),
  (v_job_a, 'Frame', 'Inspection of structural frame prior to lock-up.', current_date + 6, 'pending', v_cert_principal, false, null, true, false, null),
  (v_job_a, 'Waterproofing', 'Inspection of wet area waterproofing.', null, 'pending', v_cert_principal, false, null, false, false, null),
  (v_job_a, 'Stormwater', 'Inspection of stormwater drainage installation.', null, 'pending', v_cert_principal, false, null, false, false, null),
  (v_job_a, 'Final', 'Final inspection prior to occupation.', null, 'pending', v_cert_principal, false, null, false, false, null);

insert into defects (inspection_id, text, resolved, resolved_at)
select id, 'Additional bar chairs required to the eastern edge of the slab to maintain cover before pour.', true, now() - interval '10 days'
from inspections where job_id = v_job_a and title = 'Slab Steel';

-- ---------------------------------------------------------------------------
-- Job B — CDC in assessment, documents part-way through
-- ---------------------------------------------------------------------------
insert into jobs (id, firm_id, address, description, job_types, pathway, assigned_certifier_id, status, client_id, details, critical_stage_inspections, created_at)
values (
  v_job_b, v_firm,
  '7 Beaumont Street, Rockdale NSW 2216',
  'Alterations and additions to an existing dwelling, including a rear extension and new first floor.',
  '["Alterations & Additions"]'::jsonb, 'CDC', v_cert_second, 'active', v_client_architect,
  jsonb_build_object(
    'projectNumber','26031','zoning','R3 Medium Density Residential',
    'bcaVersion','NCC 2022 Amendment 2','bcaVolumes','["Volume Two"]'::jsonb,
    'contact', jsonb_build_object('nameOrCompany','Studio North Architects','title','Ms','givenNames','Elena','surname','Marsh','phone','(02) 5550 0231','email','elena.marsh@example.com'),
    'applicantAddress', jsonb_build_object('streetNumber','3','street','Bay Street','suburb','Brighton-Le-Sands','state','NSW','postcode','2216'),
    'ownerSameAsApplicant', false,
    'owner', jsonb_build_object('name','Michael & Anne Petrov','phone','0491 570 372'),
    'council', jsonb_build_object('lga','Bayside Council','address', jsonb_build_object('streetNumber','444-446','street','Princes Highway','suburb','Rockdale','state','NSW','postcode','2216'),'contact', jsonb_build_object('phone','(02) 5550 0666','email','council@example.com')),
    'proposal', jsonb_build_object('classifications','["1a"]'::jsonb,'constructionType','Type 3','dwellingsExisting','1','dwellingsNew','1','estimatedCost','412000','storeysAbove','2','storeysTotal','2','effectiveHeight','5.9','floorAreaExisting','118','floorAreaNew','96'),
    'siteArea','455',
    'certificateDetails', jsonb_build_object('lotSectionDp','7/A/DP12094','relevantInstrument','State Environmental Planning Policy (Exempt and Complying Development Codes) 2008','relevantPartOfCode','Part 3 — Housing Code','codeParts','["Part 3 — Housing Code"]'::jsonb)
  ),
  v_csi, now() - interval '11 days'
);

insert into checklists (job_id, kind) values (v_job_b, 'pathway') returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, version, revision, document_date, prepared_by, drawing_number, requires_stamping, sort_order) values
  (v_checklist, 'CDC Application Form', 'Complete and lodge the CDC application.', 'Other', 'approved', 1, 'A', current_date - 10, 'Studio North Architects', null, false, 0),
  (v_checklist, 'Site Plan', 'Site plan showing setbacks, boundaries and existing structures.', 'Architectural', 'approved', 1, 'A', current_date - 9, 'Studio North Architects', 'A-01', true, 1),
  (v_checklist, 'BASIX Certificate', 'Valid BASIX certificate consistent with plans.', 'Other', 'submitted', 1, 'A', current_date - 4, 'Efficient Homes Assessors', '1904822S', false, 3);
insert into checklist_items (checklist_id, title, description, category, status, version, revision, document_date, prepared_by, drawing_number, requires_stamping, sort_order)
values (v_checklist, 'Architectural Plans', 'Full set of architectural plans and elevations.', 'Architectural', 'submitted', 2, 'B', current_date - 3, 'Studio North Architects', 'A-02 to A-07', true, 2)
returning id into v_item;
insert into amendments (checklist_item_id, text, resolved) values
  (v_item, 'First floor rear setback scales at 2.8m — Housing Code requires a minimum of 3m. Please amend and resubmit.', false),
  (v_item, 'Window W04 to the southern elevation requires a privacy treatment note on the plan.', false);
insert into checklist_items (checklist_id, title, description, category, status, sort_order) values
  (v_checklist, 'Shadow Diagrams', 'Shadow diagrams demonstrating overshadowing compliance.', 'Architectural', 'requested', 4),
  (v_checklist, 'Stormwater Concept Plan', 'Concept stormwater management plan.', 'Engineering', 'requested', 5);

insert into checklists (job_id, kind) values (v_job_b, 'noc');
insert into checklists (job_id, kind) values (v_job_b, 'oc');

insert into inspections (job_id, title, description, outcome, inspector_certifier_id)
select v_job_b, v.title, v.blurb, 'pending', v_cert_second from (values
  ('Prior to CC/CDC','Site inspection prior to issue of CC or CDC.'),
  ('Piers & Footings','Inspection of piers and footings prior to pour.'),
  ('Slab Steel','Inspection of slab reinforcement prior to pour.'),
  ('Frame','Inspection of structural frame prior to lock-up.'),
  ('Waterproofing','Inspection of wet area waterproofing.'),
  ('Stormwater','Inspection of stormwater drainage installation.'),
  ('Final','Final inspection prior to occupation.')) as v(title, blurb);

-- ---------------------------------------------------------------------------
-- Job C — Construction Certificate issued, awaiting commencement
-- ---------------------------------------------------------------------------
insert into jobs (id, firm_id, address, description, job_types, pathway, assigned_certifier_id, status, client_id, details, critical_stage_inspections,
  pathway_generated, pathway_generated_date, pathway_issued_by, pathway_version, pathway_approval_uploaded, pathway_approval_date, created_at)
values (
  v_job_c, v_firm,
  '112 Rawson Road, Greenacre NSW 2190',
  'Construction of an attached dual occupancy with associated driveway and landscaping.',
  '["Dual Occupancy"]'::jsonb, 'CC', v_cert_principal, 'active', v_client_builder,
  jsonb_build_object(
    'projectNumber','26022','zoning','R2 Low Density Residential',
    'bcaVersion','NCC 2022 Amendment 2','bcaVolumes','["Volume Two"]'::jsonb,
    'contact', jsonb_build_object('nameOrCompany','Meridian Build Group','title','Mr','givenNames','Tom','surname','Whelan','phone','(02) 5550 0294','email','tom.whelan@example.com'),
    'applicantAddress', jsonb_build_object('streetNumber','8','street','Cross Street','suburb','Hurstville','state','NSW','postcode','2220'),
    'ownerSameAsApplicant', true,
    'council', jsonb_build_object('lga','Canterbury-Bankstown Council','address', jsonb_build_object('streetNumber','','street','Civic Tower, 66-72 Rickard Road','suburb','Bankstown','state','NSW','postcode','2200'),'contact', jsonb_build_object('phone','(02) 5550 0777','email','council@example.com')),
    'proposal', jsonb_build_object('classifications','["1a","10a"]'::jsonb,'constructionType','Type 3','dwellingsExisting','1','dwellingsDemolished','1','dwellingsNew','2','estimatedCost','1240000','storeysAbove','2','storeysTotal','2','effectiveHeight','7.1','floorAreaNew','361'),
    'siteArea','701',
    'certificateDetails', jsonb_build_object('lotSectionDp','22/-/DP31877','planningPortalRef','CFT-2026-208841',
      'developmentConsentNumber','DA-2025/0431','developmentConsentDate', to_char(current_date - 180, 'YYYY-MM-DD'),
      'determinationDate', to_char(current_date - 8, 'YYYY-MM-DD'),
      'lapseDate', to_char(current_date + 1817, 'YYYY-MM-DD'))
  ),
  v_csi, true, current_date - 8, v_cert_principal, 1, true, current_date - 7, now() - interval '46 days'
);
insert into pathway_certificate_versions (job_id, version, generated_date, issued_by, approval_uploaded, approval_date)
values (v_job_c, 1, current_date - 8, v_cert_principal, true, current_date - 7);

insert into checklists (job_id, kind) values (v_job_c, 'pathway') returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, version, revision, document_date, prepared_by, drawing_number, requires_stamping, sort_order) values
  (v_checklist, 'CC Application Form', 'Complete and lodge the CC application.', 'Other', 'approved', 1, 'A', current_date - 40, 'Meridian Build Group', null, false, 0),
  (v_checklist, 'Architectural Plans', 'Full set of architectural plans and elevations.', 'Architectural', 'approved', 2, 'B', current_date - 30, 'Studio North Architects', 'CC-01 to CC-12', true, 1),
  (v_checklist, 'Structural Engineering Details', 'Structural plans and computations.', 'Structural', 'approved', 1, 'A', current_date - 26, 'Calder Civil Engineering', 'S-01 to S-06', true, 2),
  (v_checklist, 'BASIX Certificate', 'Valid BASIX certificate consistent with plans.', 'Other', 'approved', 1, 'A', current_date - 38, 'Efficient Homes Assessors', '1887301S', false, 3);

insert into checklists (job_id, kind) values (v_job_c, 'noc') returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, sort_order) values
  (v_checklist, 'Notice of Commencement', 'Submit at least 2 days prior to works starting.', 'Other', 'requested', 0),
  (v_checklist, 'Appointment of PCA', 'Formal appointment of the Principal Certifying Authority.', 'Other', 'submitted', 1),
  (v_checklist, 'Long Service Levy Receipt', 'Evidence of payment of the Long Service Levy.', 'Other', 'requested', 2),
  (v_checklist, 'Home Building Compensation Certificate', 'Insurance certificate for works over $20,000.', 'Other', 'requested', 3);
insert into checklists (job_id, kind) values (v_job_c, 'oc');

insert into inspections (job_id, title, description, outcome, inspector_certifier_id)
select v_job_c, v.title, v.blurb, 'pending', v_cert_principal from (values
  ('Prior to CC/CDC','Site inspection prior to issue of CC or CDC.'),
  ('Piers & Footings','Inspection of piers and footings prior to pour.'),
  ('Slab Steel','Inspection of slab reinforcement prior to pour.'),
  ('Frame','Inspection of structural frame prior to lock-up.'),
  ('Waterproofing','Inspection of wet area waterproofing.'),
  ('Stormwater','Inspection of stormwater drainage installation.'),
  ('Final','Final inspection prior to occupation.')) as v(title, blurb);

-- ---------------------------------------------------------------------------
-- Job D — finished job: CDC, all inspections passed, whole OC issued
-- ---------------------------------------------------------------------------
insert into jobs (id, firm_id, address, description, job_types, pathway, assigned_certifier_id, status, client_id, details, critical_stage_inspections,
  pathway_generated, pathway_generated_date, pathway_issued_by, pathway_version, pathway_approval_uploaded, pathway_approval_date, created_at)
values (
  v_job_d, v_firm,
  '3 Tarrants Avenue, Eastwood NSW 2122',
  'Construction of a detached secondary dwelling to the rear of an existing dwelling.',
  '["Secondary Dwelling"]'::jsonb, 'CDC', v_cert_second, 'complete', v_client_owner,
  jsonb_build_object(
    'projectNumber','25188','zoning','R2 Low Density Residential',
    'bcaVersion','NCC 2022 Amendment 1','bcaVolumes','["Volume Two"]'::jsonb,
    'contact', jsonb_build_object('nameOrCompany','Sarah Nguyen','title','Ms','givenNames','Sarah','surname','Nguyen','mobile','0491 570 246','email','sarah.nguyen@example.com'),
    'applicantAddress', jsonb_build_object('streetNumber','3','street','Tarrants Avenue','suburb','Eastwood','state','NSW','postcode','2122'),
    'ownerSameAsApplicant', true,
    'council', jsonb_build_object('lga','City of Ryde','address', jsonb_build_object('streetNumber','1','street','Devlin Street','suburb','Ryde','state','NSW','postcode','2112'),'contact', jsonb_build_object('phone','(02) 5550 0400','email','council@example.com')),
    'proposal', jsonb_build_object('classifications','["1a","10a"]'::jsonb,'constructionType','Type 3','dwellingsExisting','1','dwellingsNew','1','estimatedCost','268000','storeysAbove','1','storeysTotal','1','effectiveHeight','3.4','floorAreaNew','59.5'),
    'siteArea','683',
    'certificateDetails', jsonb_build_object('lotSectionDp','3/-/DP18420','planningPortalRef','CDC-2025-098337',
      'relevantInstrument','State Environmental Planning Policy (Exempt and Complying Development Codes) 2008',
      'relevantPartOfCode','Part 3B — Secondary Dwellings','codeParts','["Part 3B — Secondary Dwellings"]'::jsonb,
      'determinationDate', to_char(current_date - 330, 'YYYY-MM-DD'),
      'lapseDate', to_char(current_date + 1495, 'YYYY-MM-DD'))
  ),
  v_csi, true, current_date - 330, v_cert_second, 1, true, current_date - 329, now() - interval '360 days'
);
insert into pathway_certificate_versions (job_id, version, generated_date, issued_by, approval_uploaded, approval_date)
values (v_job_d, 1, current_date - 330, v_cert_second, true, current_date - 329);

insert into oc_records (job_id, type, description, generated_date, issued_by, approval_uploaded, approval_date, portal_ref)
values (v_job_d, 'whole', 'Occupation Certificate for the completed secondary dwelling.', current_date - 21, v_cert_second, true, current_date - 20, 'CFT-2026-201774');

insert into checklists (job_id, kind) values (v_job_d, 'pathway') returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, version, revision, document_date, prepared_by, requires_stamping, sort_order) values
  (v_checklist, 'CDC Application Form', 'Complete and lodge the CDC application.', 'Other', 'approved', 1, 'A', current_date - 350, 'Sarah Nguyen', false, 0),
  (v_checklist, 'Site Plan', 'Site plan showing setbacks, boundaries and existing structures.', 'Architectural', 'approved', 1, 'A', current_date - 345, 'Drafting Works Sydney', true, 1),
  (v_checklist, 'Architectural Plans', 'Full set of architectural plans and elevations.', 'Architectural', 'approved', 2, 'B', current_date - 340, 'Drafting Works Sydney', true, 2),
  (v_checklist, 'BASIX Certificate', 'Valid BASIX certificate consistent with plans.', 'Other', 'approved', 1, 'A', current_date - 348, 'Efficient Homes Assessors', false, 3);
insert into checklists (job_id, kind) values (v_job_d, 'noc') returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, sort_order) values
  (v_checklist, 'Notice of Commencement', 'Submit at least 2 days prior to works starting.', 'Other', 'approved', 0),
  (v_checklist, 'Appointment of PCA', 'Formal appointment of the Principal Certifying Authority.', 'Other', 'approved', 1);
insert into checklists (job_id, kind) values (v_job_d, 'oc') returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, version, document_date, prepared_by, sort_order) values
  (v_checklist, 'OC Application Form', 'Complete and submit the OC Application Form.', 'Other', 'approved', 1, current_date - 30, 'Sarah Nguyen', 0),
  (v_checklist, 'BASIX Completion Receipt', 'Obtained on completion of works.', 'Other', 'approved', 1, current_date - 28, 'Efficient Homes Assessors', 1),
  (v_checklist, 'Works as Executed Stormwater Plan', 'Prepared by a registered surveyor, approved by a civil engineer.', 'Engineering', 'approved', 1, current_date - 27, 'Calder Civil Engineering', 2),
  (v_checklist, 'Final Survey', 'Survey confirming RLs, ridgelines and setbacks.', 'Other', 'approved', 1, current_date - 26, 'Baseline Surveyors', 3),
  (v_checklist, 'Termite Protection Certificate', 'Certification per AS3660.1-2000 and BCA Clause B1.4.', 'Other', 'approved', 1, current_date - 25, 'Guardian Pest Control', 4),
  (v_checklist, 'Smoke Alarm Compliance', 'Certification of smoke alarm installation.', 'Other', 'approved', 1, current_date - 24, 'Voltcraft Electrical', 5);

insert into inspections (job_id, title, description, date, outcome, inspector_certifier_id, report_sent, report_sent_date, confirmed, portal_reported, portal_reported_date)
select v_job_d, v.title, v.blurb, current_date - v.ago, 'passed', v_cert_second, true, current_date - v.ago + 1, true, true, current_date - v.ago + 1
from (values
  ('Prior to CC/CDC','Site inspection prior to issue of CC or CDC.', 334),
  ('Piers & Footings','Inspection of piers and footings prior to pour.', 300),
  ('Slab Steel','Inspection of slab reinforcement prior to pour.', 285),
  ('Frame','Inspection of structural frame prior to lock-up.', 240),
  ('Waterproofing','Inspection of wet area waterproofing.', 180),
  ('Stormwater','Inspection of stormwater drainage installation.', 150),
  ('Final','Final inspection prior to occupation.', 30)) as v(title, blurb, ago);

-- ---------------------------------------------------------------------------
-- Job E — CDC that has since been modified
-- ---------------------------------------------------------------------------
insert into jobs (id, firm_id, address, description, job_types, pathway, assigned_certifier_id, status, client_id, details, critical_stage_inspections,
  pathway_generated, pathway_generated_date, pathway_issued_by, pathway_version, pathway_approval_uploaded, pathway_approval_date, created_at)
values (
  v_job_e, v_firm,
  '58 Chapel Road, Bankstown NSW 2200',
  'In-ground swimming pool with associated fencing, and alterations to the rear elevation of the existing dwelling.',
  '["Pool","Alterations & Additions"]'::jsonb, 'CDC', v_cert_principal, 'active', v_client_architect,
  jsonb_build_object(
    'projectNumber','26008','zoning','R2 Low Density Residential',
    'bcaVersion','NCC 2022 Amendment 2','bcaVolumes','["Volume Two"]'::jsonb,
    'contact', jsonb_build_object('nameOrCompany','Studio North Architects','title','Ms','givenNames','Elena','surname','Marsh','phone','(02) 5550 0231','email','elena.marsh@example.com'),
    'applicantAddress', jsonb_build_object('streetNumber','3','street','Bay Street','suburb','Brighton-Le-Sands','state','NSW','postcode','2216'),
    'ownerSameAsApplicant', false,
    'owner', jsonb_build_object('name','George Haddad','phone','0491 570 519'),
    'council', jsonb_build_object('lga','Canterbury-Bankstown Council','address', jsonb_build_object('streetNumber','','street','Civic Tower, 66-72 Rickard Road','suburb','Bankstown','state','NSW','postcode','2200'),'contact', jsonb_build_object('phone','(02) 5550 0777','email','council@example.com')),
    'proposal', jsonb_build_object('classifications','["1a","10b"]'::jsonb,'constructionType','Type 3','dwellingsExisting','1','dwellingsNew','1','estimatedCost','156000','storeysAbove','1','storeysTotal','1','effectiveHeight','3.1','floorAreaNew','34'),
    'siteArea','590',
    'certificateDetails', jsonb_build_object('lotSectionDp','11/B/DP7702','planningPortalRef','CDC-2026-107553',
      'relevantInstrument','State Environmental Planning Policy (Exempt and Complying Development Codes) 2008',
      'relevantPartOfCode','Part 3 — Housing Code','codeParts','["Part 3 — Housing Code"]'::jsonb,
      'determinationDate', to_char(current_date - 96, 'YYYY-MM-DD'),
      'lapseDate', to_char(current_date + 1729, 'YYYY-MM-DD'))
  ),
  v_csi, true, current_date - 96, v_cert_principal, 1, true, current_date - 95, now() - interval '130 days'
);
insert into pathway_certificate_versions (job_id, version, generated_date, issued_by, approval_uploaded, approval_date)
values (v_job_e, 1, current_date - 96, v_cert_principal, true, current_date - 95);

insert into modifications (id, job_id, reason, generated, generated_date, issued_by, version, approval_uploaded, approval_date)
values (v_mod, v_job_e, 'Pool relocated 1.2m north and coping level lowered to suit the revised survey. Rear window schedule updated accordingly.', true, current_date - 18, v_cert_principal, 1, true, current_date - 17);

insert into checklists (job_id, kind) values (v_job_e, 'pathway') returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, version, revision, document_date, prepared_by, requires_stamping, sort_order) values
  (v_checklist, 'CDC Application Form', 'Complete and lodge the CDC application.', 'Other', 'approved', 1, 'A', current_date - 118, 'Studio North Architects', false, 0),
  (v_checklist, 'Site Plan', 'Site plan showing setbacks, boundaries and existing structures.', 'Architectural', 'approved', 1, 'A', current_date - 115, 'Studio North Architects', true, 1),
  (v_checklist, 'Architectural Plans', 'Full set of architectural plans and elevations.', 'Architectural', 'approved', 2, 'B', current_date - 110, 'Studio North Architects', true, 2);
insert into checklists (job_id, kind, modification_id) values (v_job_e, 'modification', v_mod) returning id into v_checklist;
insert into checklist_items (checklist_id, title, description, category, status, version, revision, document_date, prepared_by, requires_stamping, sort_order) values
  (v_checklist, 'Amended Site Plan', 'Revised site plan showing the relocated pool.', 'Architectural', 'approved', 3, 'C', current_date - 24, 'Studio North Architects', true, 0),
  (v_checklist, 'Amended Architectural Plans', 'Revised elevations and window schedule.', 'Architectural', 'approved', 3, 'C', current_date - 24, 'Studio North Architects', true, 1),
  (v_checklist, 'Updated Survey', 'Detail survey confirming revised levels.', 'Other', 'approved', 1, 'A', current_date - 30, 'Baseline Surveyors', false, 2);
insert into checklists (job_id, kind) values (v_job_e, 'noc');
insert into checklists (job_id, kind) values (v_job_e, 'oc');

insert into inspections (job_id, title, description, date, outcome, inspector_certifier_id, report_sent, confirmed)
values (v_job_e, 'Prior to CC/CDC', 'Site inspection prior to issue of CC or CDC.', current_date - 100, 'passed', v_cert_principal, true, true);
insert into inspections (job_id, title, description, outcome, inspector_certifier_id)
select v_job_e, v.title, v.blurb, 'pending', v_cert_principal from (values
  ('Piers & Footings','Inspection of piers and footings prior to pour.'),
  ('Slab Steel','Inspection of slab reinforcement prior to pour.'),
  ('Waterproofing','Inspection of wet area waterproofing.'),
  ('Stormwater','Inspection of stormwater drainage installation.'),
  ('Final','Final inspection prior to occupation.')) as v(title, blurb);

-- ---------------------------------------------------------------------------
-- Quotes — one still being written, one out with the client, one won
-- ---------------------------------------------------------------------------
insert into quotes (id, firm_id, quote_number, state, project_type, pathway, required_start_date, required_end_date, proposal_address, lot_section_plan,
  certifier_id, classifications, development_description, owner_is_applicant, applicant, owner, council_lga, client_id, scope_of_works, status, payment_status, created_at)
values
  (v_quote_draft, v_firm, 'Q-2026-0148', 'NSW', 'New Dwelling', 'CDC', current_date - 2, current_date + 21,
   '19 Lorraine Street, Peakhurst NSW 2210', '9/-/DP225471', v_cert_principal, '["1a","10a"]'::jsonb,
   'Demolition of the existing dwelling and construction of a new two-storey dwelling with attached garage.', true,
   jsonb_build_object('name','Rebecca Toohey','email','rebecca.toohey@example.com','phone','0491 570 683','address', jsonb_build_object('streetNumber','19','street','Lorraine Street','suburb','Peakhurst','state','NSW','postcode','2210')),
   '{}'::jsonb, 'Georges River Council', null,
   '["Assessment of the Complying Development Certificate application.","Determination of the Complying Development Certificate.","Carrying out all mandatory critical stage inspections.","Occupation Certificate assessment and determination."]'::jsonb,
   'draft', 'unpaid', now() - interval '2 days'),

  (v_quote_sent, v_firm, 'Q-2026-0146', 'NSW', 'Dual Occupancy', 'CC', current_date - 9, current_date + 14,
   '46 Hillcrest Avenue, Yagoona NSW 2199', '4/-/DP19883', v_cert_principal, '["1a","10a"]'::jsonb,
   'Construction of an attached dual occupancy under an approved development consent.', false,
   jsonb_build_object('name','Meridian Build Group','email','tom.whelan@example.com','phone','(02) 5550 0294','address', jsonb_build_object('streetNumber','8','street','Cross Street','suburb','Hurstville','state','NSW','postcode','2220')),
   jsonb_build_object('name','Layla Haddad','phone','0491 570 902'), 'Canterbury-Bankstown Council', v_client_builder,
   '["Assessment of the Construction Certificate application.","Determination of the Construction Certificate.","Principal Certifier appointment and mandatory inspections.","Occupation Certificate assessment and determination."]'::jsonb,
   'sent', 'unpaid', now() - interval '9 days'),

  (v_quote_accepted, v_firm, 'Q-2026-0141', 'NSW', 'Alterations & Additions', 'CDC', current_date - 16, current_date + 5,
   '7 Beaumont Street, Rockdale NSW 2216', '7/A/DP12094', v_cert_second, '["1a"]'::jsonb,
   'Alterations and additions to an existing dwelling, including a rear extension and new first floor.', false,
   jsonb_build_object('name','Studio North Architects','email','elena.marsh@example.com','phone','(02) 5550 0231','address', jsonb_build_object('streetNumber','3','street','Bay Street','suburb','Brighton-Le-Sands','state','NSW','postcode','2216')),
   jsonb_build_object('name','Michael & Anne Petrov','phone','0491 570 372'), 'Bayside Council', v_client_architect,
   '["Assessment of the Complying Development Certificate application.","Determination of the Complying Development Certificate.","Carrying out all mandatory critical stage inspections.","Occupation Certificate assessment and determination."]'::jsonb,
   'accepted', 'paid', now() - interval '16 days');

update quotes set linked_job_id = v_job_b, payment_received_date = current_date - 12 where id = v_quote_accepted;

insert into quote_fee_lines (quote_id, description, amount, sort_order) values
  (v_quote_draft, 'Complying Development Certificate assessment and issue, including review of all supporting documentation and plans', 2650, 0),
  (v_quote_draft, 'Principal Certifier appointment and all mandatory critical stage inspections', 1900, 1),
  (v_quote_draft, 'Occupation Certificate assessment and issue', 750, 2),
  (v_quote_sent, 'Construction Certificate assessment and issue', 3200, 0),
  (v_quote_sent, 'Principal Certifier appointment and all mandatory critical stage inspections (two dwellings)', 2800, 1),
  (v_quote_sent, 'Occupation Certificate assessment and issue', 950, 2),
  (v_quote_accepted, 'Complying Development Certificate assessment and issue', 2300, 0),
  (v_quote_accepted, 'Principal Certifier appointment and all mandatory critical stage inspections', 1750, 1),
  (v_quote_accepted, 'Occupation Certificate assessment and issue', 700, 2);

-- ---------------------------------------------------------------------------
-- Dashboard task board
-- ---------------------------------------------------------------------------
insert into task_lists (firm_id, title, sort_order) values (v_firm, 'CDC/CC Assessments', 0) returning id into v_list;
insert into manual_tasks (list_id, text, sort_order) values
  (v_list, 'Beaumont Street — recheck rear setback once amended plans arrive', 0),
  (v_list, 'Lorraine Street — confirm BASIX matches the window schedule', 1);

insert into task_lists (firm_id, title, sort_order) values (v_firm, 'CDC/CC Approvals Typing', 1) returning id into v_list;
insert into manual_tasks (list_id, text, completed, completed_at, sort_order) values
  (v_list, 'Rawson Road — CC approval set typed and issued', true, now() - interval '8 days', 0);

insert into task_lists (firm_id, title, sort_order) values (v_firm, 'OC Assessments', 2) returning id into v_list;
insert into manual_tasks (list_id, text, sort_order) values
  (v_list, 'Wentworth Avenue — OC documents not yet received', 0);

insert into task_lists (firm_id, title, sort_order) values (v_firm, 'PC Appointment', 3) returning id into v_list;
insert into manual_tasks (list_id, text, note, sort_order) values
  (v_list, 'Rawson Road — awaiting PC appointment on the Portal', 'Builder advised it will be lodged this week.', 0);

insert into task_lists (firm_id, title, sort_order) values (v_firm, 'Inspections', 4) returning id into v_list;
insert into manual_tasks (list_id, text, sort_order) values
  (v_list, 'Wentworth Avenue — frame inspection booked, confirm access with site', 0);

insert into task_lists (firm_id, title, sort_order) values
  (v_firm, 'Neighbouring Notifications', 5),
  (v_firm, 'Payments', 6);

raise notice 'Demo firm created. Log in as the auth user you linked to see it.';
end $$;

-- =============================================================================
-- To remove the demo firm later (deletes ONLY the demo firm and everything
-- under it — your real firm is untouched), run this on its own:
--
--   delete from firms where name = 'Harbourview Certifiers';
--
-- Then delete the demo login under Authentication -> Users.
-- =============================================================================
