-- A checklist item the firm keeps to itself.
--
-- Not everything on a checklist is the client's business. A peer review,
-- a note to chase council, a fee to collect before the certificate goes
-- out — these belong on the same list as the documents, because that is
-- the list the certifier actually works from, but showing them in the
-- portal invites a phone call about a step the client cannot do anything
-- about.
--
-- Hidden at the database, not on the screen. A client's session cannot
-- read an internal item at all, so no page, download or export can leak
-- one by forgetting to filter.

alter table checklist_items add column if not exists internal boolean not null default false;

drop policy if exists "client read checklist_items" on checklist_items;
create policy "client read checklist_items" on checklist_items for select
  using (
    current_app_role() = 'client'
    and coalesce(internal, false) = false
    and exists (select 1 from checklists c where c.id = checklist_id and job_visible_to_client(c.job_id))
  );

-- An internal item never holds up the client either. Booking waits on
-- what the client can actually see and act on; an invisible item that
-- silently blocked a booking would be a dead end with no explanation.
create or replace function noc_checklist_outstanding(p_job_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*) filter (where i.status <> 'approved')::int
  from checklist_items i
  join checklists c on c.id = i.checklist_id
  where c.job_id = p_job_id and c.kind = 'noc' and coalesce(i.internal, false) = false
$$;
