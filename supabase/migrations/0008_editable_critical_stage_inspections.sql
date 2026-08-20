-- critical_stage_inspections used to store just a list of numbers
-- (e.g. [1,2,3,4,5,6]) referencing a fixed, hardcoded list of the six
-- mandatory inspections. Certifiers now need to add extra inspections and
-- edit/remove the mandatory ones per job, so each job needs its own full
-- copy of the data (stage text, inspector, enabled) instead of a reference
-- into a shared constant.

update jobs
set critical_stage_inspections = (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.no::text,
      'stage', m.stage,
      'inspector', m.inspector,
      'enabled', jobs.critical_stage_inspections @> to_jsonb(m.no)
    )
    order by m.no
  ), '[]'::jsonb)
  from (values
    (1, 'After excavation for and prior to placement of any footings', 'Registered Certifier & Structural Engineer'),
    (2, 'Prior to pouring any in-situ reinforced concrete building element', 'Registered Certifier & Structural Engineer'),
    (3, 'Prior to covering of the framework for any floor, wall, roof, or other building element', 'Registered Certifier & Structural Engineer'),
    (4, 'Prior to covering waterproofing in any wet areas', 'Registered Certifier'),
    (5, 'Prior to covering any stormwater drainage connections', 'Registered Certifier'),
    (6, 'After the building work has been completed & prior to any Occupation Certificate being issued in relation to the building', 'Principal Certifier')
  ) as m(no, stage, inspector)
)
where jsonb_typeof(critical_stage_inspections) = 'array'
  and jsonb_typeof(critical_stage_inspections -> 0) = 'number';

alter table jobs alter column critical_stage_inspections set default '[]'::jsonb;
