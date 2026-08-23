-- Where the approval stamp sits on a stamped plan, and how big it is.
--
-- Stored as a fraction of the page (0 = left/top edge, 1 = right/bottom
-- edge) rather than in millimetres, so one placement holds whether the
-- sheet is A4 or A0, portrait or landscape. x and y are the stamp's
-- top-left corner measured from the page's top-left. scale is a
-- multiplier on the stamp's natural size, 1 being the size it has always
-- been drawn at. Null everywhere means "bottom-right corner at normal
-- size", which is where the stamp sat before it could be moved.

alter table checklist_items
  add column if not exists stamp_x numeric,
  add column if not exists stamp_y numeric,
  add column if not exists stamp_scale numeric;

-- The firm's last-used placement, so the next plan starts where the last
-- one was put instead of back in the corner every time.
alter table firms
  add column if not exists stamp_x numeric,
  add column if not exists stamp_y numeric,
  add column if not exists stamp_scale numeric;
