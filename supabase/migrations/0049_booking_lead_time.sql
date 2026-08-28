-- How much notice an inspection needs.
--
-- The rule the firm actually works to, replacing the one this app
-- started with:
--
--   * Asked before 1pm, the earliest is tomorrow. Asked at 1pm or
--     after, the earliest is the day after — half a working day is the
--     least notice an inspector can be given, and the old 2pm cut-off
--     was leaving too little of the afternoon to arrange it.
--   * Anything asked on a Friday, a Saturday or a Sunday is booked for
--     the Tuesday. A Monday inspection would have to be arranged over a
--     weekend nobody is working.
--   * A date that still lands on a weekend moves to the Tuesday for the
--     same reason — so a Thursday afternoon request goes to Tuesday
--     rather than Saturday.
--
-- Mirrored in lib/business.ts so the portal can suggest a valid date
-- before asking the server. This function is the one that decides.

create or replace function earliest_bookable_inspection_date(p_now timestamptz default now())
returns date
language plpgsql
stable
as $$
declare
  v_local timestamp := p_now at time zone 'Australia/Sydney';
  v_dow int := extract(dow from v_local); -- 0 Sun .. 6 Sat
  v_date date := v_local::date;
  v_result date;
begin
  -- Friday and the weekend all point at the same Tuesday.
  if v_dow = 5 then
    return v_date + 4;
  elsif v_dow = 6 then
    return v_date + 3;
  elsif v_dow = 0 then
    return v_date + 2;
  end if;

  if extract(hour from v_local) >= 13 then
    v_result := v_date + 2;
  else
    v_result := v_date + 1;
  end if;

  -- A date landing on a weekend moves to the Tuesday, never the Monday.
  if extract(dow from v_result) = 6 then
    v_result := v_result + 3;
  elsif extract(dow from v_result) = 0 then
    v_result := v_result + 2;
  end if;

  return v_result;
end;
$$;
