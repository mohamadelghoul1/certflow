-- Run this ONCE, after 0001_init.sql and 0002_client_invite.sql, to create
-- your firm and your own first certifier login. See README.md step 5 for
-- the full walkthrough (you'll create the login user in the Supabase
-- dashboard first, then come back and run this with its ID pasted in).

-- 1) Creates the firm — edit these details to your own.
insert into firms (id, name, abn, postal_address, office_address, phone, email, website)
values (
  gen_random_uuid(),
  'Quality Private Certifiers',
  '41 630 945 416',
  'PO BOX 195, Blaxcell NSW 2142',
  'Suite 2/F1 101 Rookwood Road, Yagoona NSW 2199',
  '0404 940 898',
  'info@qpcertifiers.com.au',
  'www.qpcertifiers.com.au'
)
returning id; -- <- copy this id, you'll need it below

-- 2) Creates your first certifier registry entry (the person who can be
--    picked as the issuer on certificates/inspections). Replace
--    <FIRM_ID> with the id printed above.
insert into certifiers (id, firm_id, name, registration_no, registration_body)
values (
  gen_random_uuid(),
  '<FIRM_ID>',
  'Your Name',
  'BDC0000',
  'Building Commission NSW'
)
returning id; -- <- copy this id too

-- 3) Links your Supabase Auth login to the firm + certifier record above.
--    Replace <AUTH_USER_ID> with the UUID shown next to the user you
--    created in Authentication -> Users, <FIRM_ID> with the id from step 1,
--    and <CERTIFIER_ID> with the id from step 2.
insert into profiles (id, firm_id, role, certifier_id, full_name, email)
values (
  '<AUTH_USER_ID>',
  '<FIRM_ID>',
  'certifier',
  '<CERTIFIER_ID>',
  'Your Name',
  'you@example.com'
);
