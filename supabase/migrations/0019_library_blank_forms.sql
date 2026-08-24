-- Blank forms attached to the document library.
--
-- Most of the documents a client has to provide are theirs to produce —
-- plans, a BASIX certificate, a survey. A few are the firm's own forms
-- that the client fills in and hands back: the certification contract,
-- the CDC/CC application, the notice of commencement, the OC
-- application. Until now the checklist asked for those without ever
-- giving the client the form to complete.
--
-- A library item can now carry the blank form itself. The link on a job's
-- checklist item points at the library item rather than at a copy of the
-- file, so replacing the form under Settings -> Document Library updates
-- every project at once — nobody is left completing last year's version.

alter table document_library_items
  add column if not exists template_file_path text,
  add column if not exists template_file_name text;

alter table checklist_items
  add column if not exists template_library_item_id uuid references document_library_items(id) on delete set null;

create index if not exists checklist_items_template_library_item_id_idx
  on checklist_items(template_library_item_id);

-- The certification contract, which every CDC and CC client signs and
-- returns. Added for firms that don't already have an item by that name,
-- at the end of their existing list.
insert into document_library_items (firm_id, pathway, title, description, category, sort_order)
select f.id, v.pathway, v.title, v.description, v.category,
       coalesce((select max(li.sort_order) + 1 from document_library_items li
                 where li.firm_id = f.id and li.pathway = v.pathway), 0)
from firms f
cross join (values
  ('CDC', 'Contract for Certification Works', 'Download, complete and sign the certification contract, then upload the signed copy.', 'Other'),
  ('CC',  'Contract for Certification Works', 'Download, complete and sign the certification contract, then upload the signed copy.', 'Other')
) as v(pathway, title, description, category)
where not exists (
  select 1 from document_library_items existing
  where existing.firm_id = f.id
    and existing.pathway = v.pathway
    and lower(btrim(existing.title)) = lower(btrim(v.title))
);

-- Projects that already exist keep working: every checklist item whose
-- title matches a library item of the right kind is pointed at it, so a
-- blank form uploaded after this migration appears on old projects too,
-- not just on ones created from here on.
update checklist_items ci
set template_library_item_id = li.id
from checklists c
join jobs j on j.id = c.job_id
join document_library_items li on li.firm_id = j.firm_id
where ci.checklist_id = c.id
  and li.pathway = case c.kind
                     when 'noc' then 'NOC'
                     when 'oc' then 'OC'
                     else j.pathway
                   end
  and lower(btrim(li.title)) = lower(btrim(ci.title))
  and ci.template_library_item_id is null;
