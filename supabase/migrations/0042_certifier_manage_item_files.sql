-- Certifiers could read and insert document records but never update or
-- delete them — migration 0021 granted only select and insert. So
-- "Remove this document" and edits to a document's label/preparer/
-- reference silently changed nothing: row security ignored them without
-- an error. Same firm-scope rule as the existing policies.

drop policy if exists "certifier update checklist_item_files" on checklist_item_files;
create policy "certifier update checklist_item_files" on checklist_item_files for update
  using (
    current_app_role() = 'certifier'
    and exists (
      select 1 from checklist_items i
      join checklists c on c.id = i.checklist_id
      join jobs j on j.id = c.job_id
      where i.id = checklist_item_id and j.firm_id = current_firm_id()
    )
  )
  with check (
    current_app_role() = 'certifier'
    and exists (
      select 1 from checklist_items i
      join checklists c on c.id = i.checklist_id
      join jobs j on j.id = c.job_id
      where i.id = checklist_item_id and j.firm_id = current_firm_id()
    )
  );

drop policy if exists "certifier delete checklist_item_files" on checklist_item_files;
create policy "certifier delete checklist_item_files" on checklist_item_files for delete
  using (
    current_app_role() = 'certifier'
    and exists (
      select 1 from checklist_items i
      join checklists c on c.id = i.checklist_id
      join jobs j on j.id = c.job_id
      where i.id = checklist_item_id and j.firm_id = current_firm_id()
    )
  );
