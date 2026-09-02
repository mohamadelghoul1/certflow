-- Certlyn's own default layout and wording, editable rather than
-- compiled in.
--
-- A firm that has saved neither prints the built-in default. That is
-- right for a firm using Certlyn and wrong for the firm that runs it:
-- the owner improves the standard certificate for everyone and has no
-- way to publish it short of a code change.
--
-- So a row with no firm against it is the platform default: every firm
-- may read it, only the platform owner may write it, and a firm that
-- has saved its own is untouched by it — having customised the layout
-- is a decision, not something to be overwritten from outside.
--
-- Safe to run twice.

-- ---------------------------------------------------------------- layout
alter table certificate_templates alter column firm_id drop not null;

-- unique(firm_id, pathway) does not constrain the platform rows, because
-- two NULLs are never equal in Postgres — without this, "save the
-- default" would quietly stack up a new row each time and the loader
-- would pick whichever came back first.
create unique index if not exists certificate_templates_platform_pathway_idx
  on certificate_templates (pathway) where firm_id is null;

drop policy if exists "certifier manage own firm certificate templates" on certificate_templates;
create policy "certifier manage own firm certificate templates" on certificate_templates for all
  using (current_app_role() = 'certifier' and firm_id = current_firm_id())
  with check (current_app_role() = 'certifier' and firm_id = current_firm_id());

-- Every certifier reads the platform default — it is the fallback their
-- own certificate is drawn from.
drop policy if exists "certifier read platform certificate templates" on certificate_templates;
create policy "certifier read platform certificate templates" on certificate_templates for select
  using (current_app_role() = 'certifier' and firm_id is null);

-- Only the owner writes it. Checked against the flag on their own firm,
-- so revoking it revokes this too.
drop policy if exists "platform owner writes certificate templates" on certificate_templates;
create policy "platform owner writes certificate templates" on certificate_templates for all
  using (
    current_app_role() = 'certifier' and firm_id is null
    and exists (select 1 from firms f where f.id = current_firm_id() and f.platform_owner)
  )
  with check (
    current_app_role() = 'certifier' and firm_id is null
    and exists (select 1 from firms f where f.id = current_firm_id() and f.platform_owner)
  );

-- --------------------------------------------------------------- wording
alter table firm_document_wording alter column firm_id drop not null;

create unique index if not exists firm_document_wording_platform_key_idx
  on firm_document_wording (doc_key) where firm_id is null;

drop policy if exists "certifier manage own firm document wording" on firm_document_wording;
create policy "certifier manage own firm document wording" on firm_document_wording for all
  using (current_app_role() = 'certifier' and firm_id = current_firm_id())
  with check (current_app_role() = 'certifier' and firm_id = current_firm_id());

drop policy if exists "certifier read platform document wording" on firm_document_wording;
create policy "certifier read platform document wording" on firm_document_wording for select
  using (current_app_role() = 'certifier' and firm_id is null);

drop policy if exists "platform owner writes document wording" on firm_document_wording;
create policy "platform owner writes document wording" on firm_document_wording for all
  using (
    current_app_role() = 'certifier' and firm_id is null
    and exists (select 1 from firms f where f.id = current_firm_id() and f.platform_owner)
  )
  with check (
    current_app_role() = 'certifier' and firm_id is null
    and exists (select 1 from firms f where f.id = current_firm_id() and f.platform_owner)
  );
