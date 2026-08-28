-- A Thursday afternoon request is booked for the Monday.
--
-- Supersedes 0049 — run this one and 0049 becomes unnecessary; running
-- both, in either order, leaves the same result. The whole function is
-- replaced here so there is only ever one version of the rule.
--
-- What changed: a date that lands on a weekend now moves to the Monday
-- rather than the Tuesday. The reason a Friday or weekend enquiry waits
-- until Tuesday is that it would otherwise have to be arranged over a
-- weekend nobody is working; a Thursday afternoon request has all of
-- Friday for that, so its Saturday becomes the Monday.
--
-- The rule in full:
--
--   * Asked before 1pm, the earliest is tomorrow. Asked at 1pm or
--     after, the earliest is the day after.
--   * Asked on a Friday, Saturday or Sunday, it is the Tuesday.
--   * A date that still lands on a weekend moves to the Monday.
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

  -- Monday, not Tuesday: there is a working Friday in between to
  -- arrange it.
  if extract(dow from v_result) = 6 then
    v_result := v_result + 2;
  elsif extract(dow from v_result) = 0 then
    v_result := v_result + 1;
  end if;

  return v_result;
end;
$$;
