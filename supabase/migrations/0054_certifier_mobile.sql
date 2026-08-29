-- The mobile a client should ring about an inspection.
--
-- The firm's phone number already exists, but it is the office line
-- printed on every certificate, letterhead, quote and invoice — so
-- putting a mobile in it would put the mobile on all of those. This is a
-- separate number for a separate purpose: the client's portal shows it
-- beside a confirmed booking, so a builder whose slab is not ready rings
-- the person actually attending rather than the office.
--
-- Safe to run twice.

alter table certifiers add column if not exists mobile text;

comment on column certifiers.mobile is
  'Mobile shown to clients in the portal for changing a booked inspection. Not the office line printed on certificates.';
