-- A certifier's own email address, for the notifications Certlyn sends
-- them: client uploads, inspection bookings. Until now only the firm
-- had an email field, so a certifier not linked to a Certlyn login
-- could not be reached at all.
alter table certifiers add column if not exists email text;
