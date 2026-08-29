-- The Occupation Certificate joins the layouts a firm can make its own.
--
-- 0055 allowed only CDC and CC. Everything else about the table is
-- unchanged, including who may read it.
--
-- Safe to run twice.

alter table certificate_templates drop constraint if exists certificate_templates_pathway_check;
alter table certificate_templates add constraint certificate_templates_pathway_check check (pathway in ('CDC','CC','OC'));

-- A marker, so the System check page can tell whether this migration has
-- been run.
--
-- All this migration changes is a check constraint, and a constraint
-- cannot be probed by reading — only by attempting a write, which a
-- status page has no business doing. So it says so plainly instead.
create or replace function oc_certificate_template_allowed()
returns boolean
language sql
immutable
as $$ select true $$;

grant execute on function oc_certificate_template_allowed() to authenticated;
