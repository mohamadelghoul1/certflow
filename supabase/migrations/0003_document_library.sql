-- Per-firm, editable document library. Previously the "standard" documents
-- for each checklist type (CDC/CC/NOC/OC) were a hardcoded constant shared
-- by every firm; this makes it a real per-firm table the certifier manages
-- under Settings, and every place that used the hardcoded list (new job
-- creation, "start a modification", the "+ Request documents" picker) now
-- reads from here instead.

create table document_library_items (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  pathway text not null check (pathway in ('CDC','CC','NOC','OC')),
  title text not null,
  description text,
  category text default 'Other',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on document_library_items(firm_id, pathway);

alter table document_library_items enable row level security;

create policy "certifier crud document_library_items" on document_library_items for all
  using (firm_id = current_firm_id() and current_app_role() = 'certifier')
  with check (firm_id = current_firm_id() and current_app_role() = 'certifier');

-- Everyone signing up gets sensible starting points instead of a blank
-- library — back-filled here for every firm that already exists too, so
-- running this migration on a live project doesn't leave you with nothing.
insert into document_library_items (firm_id, pathway, title, description, category, sort_order)
select f.id, v.pathway, v.title, v.description, v.category, v.sort_order
from firms f
cross join (values
  ('CDC', 'CDC Application Form', 'Complete and lodge the CDC application.', 'Other', 0),
  ('CDC', 'Site Plan', 'Site plan showing setbacks, boundaries and existing structures.', 'Architectural', 1),
  ('CDC', 'Architectural Plans', 'Full set of architectural plans and elevations.', 'Architectural', 2),
  ('CDC', 'BASIX Certificate', 'Valid BASIX certificate consistent with plans.', 'Other', 3),
  ('CDC', 'Shadow Diagrams', 'Shadow diagrams demonstrating overshadowing compliance.', 'Architectural', 4),
  ('CDC', 'Stormwater Concept Plan', 'Concept stormwater management plan.', 'Engineering', 5),

  ('CC', 'CC Application Form', 'Complete and lodge the CC application.', 'Other', 0),
  ('CC', 'Architectural Plans', 'Full set of architectural plans and elevations.', 'Architectural', 1),
  ('CC', 'Structural Engineering Details', 'Structural plans and computations.', 'Structural', 2),
  ('CC', 'BASIX Certificate', 'Valid BASIX certificate consistent with plans.', 'Other', 3),
  ('CC', 'Fire Safety Schedule', 'Schedule of fire safety measures (if applicable).', 'Other', 4),

  ('NOC', 'Notice of Commencement', 'Submit at least 2 days prior to works starting.', 'Other', 0),
  ('NOC', 'Appointment of PCA', 'Formal appointment of the Principal Certifying Authority.', 'Other', 1),
  ('NOC', 'Long Service Levy Receipt', 'Evidence of payment of the Long Service Levy.', 'Other', 2),
  ('NOC', 'Home Building Compensation Certificate', 'Insurance certificate for works over $20,000.', 'Other', 3),

  ('OC', 'OC Application Form', 'Complete and submit the OC Application Form.', 'Other', 0),
  ('OC', 'BASIX Completion Receipt', 'Obtained on completion of works.', 'Other', 1),
  ('OC', 'Works as Executed Stormwater Plan', 'Prepared by a registered surveyor, approved by a civil engineer.', 'Engineering', 2),
  ('OC', 'Section 73 Compliance Certificate', 'Sydney Water compliance certificate for completed works.', 'Other', 3),
  ('OC', 'Final Survey', 'Survey confirming RLs, ridgelines and setbacks.', 'Other', 4),
  ('OC', 'Termite Protection Certificate', 'Certification per AS3660.1-2000 and BCA Clause B1.4.', 'Other', 5),
  ('OC', 'Landscaping Certification', 'Certification that landscape works meet approved plans.', 'Other', 6),
  ('OC', 'Smoke Alarm Compliance', 'Certification of smoke alarm installation.', 'Other', 7)
) as v(pathway, title, description, category, sort_order)
where not exists (
  select 1 from document_library_items existing where existing.firm_id = f.id and existing.pathway = v.pathway
);
