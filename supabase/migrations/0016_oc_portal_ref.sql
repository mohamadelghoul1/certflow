-- The NSW Planning Portal reference for an occupation certificate.
--
-- Each occupation certificate is its own application on the Portal — a
-- partial and a final OC on the same job are lodged separately and come
-- back with different numbers — so this belongs on the certificate rather
-- than on the job. Certificate applications take the CFT series, unlike a
-- complying development application, which takes the CDC series and is
-- still recorded in the job's details.

alter table oc_records
  add column if not exists portal_ref text;
