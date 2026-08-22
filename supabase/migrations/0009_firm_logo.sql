-- Lets a firm upload its own logo (Settings -> Firm details), shown in the
-- header of generated certificate/inspection-report documents alongside
-- the existing postal/office/phone/email fields.
alter table firms add column if not exists logo_url text;
