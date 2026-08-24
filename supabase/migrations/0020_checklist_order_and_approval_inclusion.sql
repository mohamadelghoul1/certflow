-- Two things a certifier needs control of on a checklist: the order the
-- documents sit in, and whether a document belongs in the approval at all.
--
-- Order matters because the checklist's order is the order the approved
-- set is assembled in, and Schedule 1 lists them in. Until now that was
-- fixed at whatever the document library happened to be in.
--
-- Inclusion matters because not everything a client sends is part of the
-- approval that gets handed on. The signed certification contract is the
-- clearest case: it's a document the certifier must collect and keep, and
-- it has no place in the set that goes to a builder or a council.

alter table checklist_items
  add column if not exists include_in_approval boolean not null default true;

-- Items requested through "+ Request documents" were all inserted with
-- sort_order 0, so their order was whatever the database happened to
-- return. Number every checklist's items from 0, keeping the order they
-- currently appear in, so moving one up or down means something.
with ordered as (
  select id,
         row_number() over (partition by checklist_id order by sort_order, created_at) - 1 as position
  from checklist_items
)
update checklist_items ci
set sort_order = ordered.position
from ordered
where ordered.id = ci.id
  and ci.sort_order <> ordered.position;
