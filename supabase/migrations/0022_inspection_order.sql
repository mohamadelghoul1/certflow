-- The order the inspections sit in on a job.
--
-- Until now the list had no order of its own: it came back in whatever
-- order the database happened to return, which is roughly the order the
-- rows were created but is not guaranteed and shifts as rows are added
-- and removed. A certifier adding a pool steel inspection to a job that
-- already has six stages needs to put it where it belongs in the
-- sequence, the same way the CDC checklist's documents can be reordered.

alter table inspections
  add column if not exists sort_order int not null default 0;

-- Every existing inspection was inserted with the same sort_order, so
-- their order would be arbitrary the moment one was moved. Number each
-- job's inspections from 0, keeping the order they appear in today, so
-- moving one up or down means something.
with ordered as (
  select id,
         row_number() over (partition by job_id order by sort_order, created_at) - 1 as position
  from inspections
)
update inspections i
set sort_order = ordered.position
from ordered
where ordered.id = i.id
  and i.sort_order <> ordered.position;

create index if not exists inspections_job_order_idx on inspections(job_id, sort_order);
