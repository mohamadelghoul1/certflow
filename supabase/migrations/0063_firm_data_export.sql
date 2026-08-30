-- Everything a firm would need to rebuild its records.
--
-- Cloud backup copies documents. It does not copy the register behind
-- them: which certificates were issued, against which jobs, on which
-- dates, with which inspection outcomes, and the audit trail. Lose the
-- database and a certifier still has their PDFs and no record of what
-- they certified — which for a registered certifier is not an
-- inconvenience but a regulatory problem.
--
-- The tables are discovered, not listed. A hand-written list is right on
-- the day it is written and quietly wrong from the next migration
-- onward, and a backup that has silently stopped covering a table is
-- worse than none, because it is trusted. So this walks the schema: the
-- tables that carry a firm, then the tables that hang off a job, then
-- the ones that hang off those.
--
-- Safe to run twice.

create or replace function export_firm_data(p_firm_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out jsonb := '{}'::jsonb;
  v_rows jsonb;
  t record;
  -- Never exported. These hold the firm's live Stripe and Resend keys,
  -- which migrations 0059 and 0060 went to some trouble to make
  -- unreadable by anything holding a login. A backup file is written to
  -- disk and copied to somebody's Dropbox, so putting the keys in one
  -- would hand them out by the safest-sounding route available.
  --
  -- Nothing is lost by leaving them out: a firm restoring from this
  -- pastes its keys back in from Stripe and Resend, which is a two
  -- minute job and the correct one after a disaster anyway.
  v_secret_tables constant text[] := array['firm_payment_credentials', 'firm_email_credentials'];
begin
  -- A firm's own certifier, or the server acting on their behalf for the
  -- scheduled copy. Nobody exports another firm's records.
  if not (
    current_user = 'service_role'
    or (current_app_role() = 'certifier' and current_firm_id() = p_firm_id)
  ) then
    raise exception 'a firm may only export its own records';
  end if;

  -- The firm itself.
  select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) into v_rows from firms f where f.id = p_firm_id;
  v_out := v_out || jsonb_build_object('firms', v_rows);

  -- Everything that names the firm directly.
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'firm_id'
      and c.table_name <> all (v_secret_tables)
    order by c.table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %I x where x.firm_id = $1', t.table_name)
      into v_rows using p_firm_id;
    v_out := v_out || jsonb_build_object(t.table_name, v_rows);
  end loop;

  -- Everything that hangs off a job.
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'job_id'
      and c.table_name not in (select table_name from information_schema.columns
                               where table_schema = 'public' and column_name = 'firm_id')
    order by c.table_name
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %I x
         where x.job_id in (select j.id from jobs j where j.firm_id = $1)', t.table_name)
      into v_rows using p_firm_id;
    v_out := v_out || jsonb_build_object(t.table_name, v_rows);
  end loop;

  -- And the ones another level down, reached through their parent.
  for t in
    select * from (values
      ('checklist_items', 'checklist_id', 'select c.id from checklists c join jobs j on j.id = c.job_id where j.firm_id = $1'),
      ('checklist_item_files', 'checklist_item_id', 'select i.id from checklist_items i join checklists c on c.id = i.checklist_id join jobs j on j.id = c.job_id where j.firm_id = $1'),
      ('amendments', 'checklist_item_id', 'select i.id from checklist_items i join checklists c on c.id = i.checklist_id join jobs j on j.id = c.job_id where j.firm_id = $1'),
      ('defects', 'inspection_id', 'select i.id from inspections i join jobs j on j.id = i.job_id where j.firm_id = $1'),
      ('inspection_photos', 'inspection_id', 'select i.id from inspections i join jobs j on j.id = i.job_id where j.firm_id = $1'),
      ('invoice_lines', 'invoice_id', 'select v.id from invoices v where v.firm_id = $1')
    ) as x(table_name, fk, parents)
  loop
    if to_regclass('public.' || t.table_name) is not null then
      execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %I x where x.%I in (%s)',
                     t.table_name, t.fk, t.parents)
        into v_rows using p_firm_id;
      v_out := v_out || jsonb_build_object(t.table_name, v_rows);
    end if;
  end loop;

  return jsonb_build_object(
    'exported_at', now(),
    'firm_id', p_firm_id,
    -- Said out loud, so whoever restores this knows what they still have
    -- to do rather than discovering it when the first payment fails.
    'excluded', jsonb_build_object(
      'tables', to_jsonb(v_secret_tables),
      'why', 'Live Stripe and Resend keys are never written to a backup. Paste them back in from Stripe and Resend after restoring.'
    ),
    -- Named so a restorer knows what they are holding without opening it.
    'format', 'certlyn-firm-export-v1',
    'tables', v_out
  );
end;
$$;

grant execute on function export_firm_data(uuid) to authenticated;
