-- 0077: The introductory rate ends on a date, not after N months.
--
-- The offer is $99 + GST a month until 30 June 2027, after which every
-- firm on it pays the standard $399 + GST. That is one date for
-- everybody rather than six months counted from each firm's own start:
-- a firm joining in January 2027 holds the rate for six months, one
-- joining in May holds it for two.
--
-- And billing runs by the calendar month. A firm that starts on the 9th
-- pays that whole month — which is already how the counting works, since
-- a project is counted in the calendar month it was created.

alter table firm_plans add column if not exists intro_until date not null default date '2027-06-30';
alter table firm_plans drop column if exists intro_months;

comment on column firm_plans.intro_until is
  'Last day of the introductory rate. Whole calendar months up to and including this month are charged at intro_fee_cents.';
