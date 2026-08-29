-- A firm's own certificate layout.
--
-- Every firm uses CertFlow's layout until it chooses not to. A firm that
-- wants a row we do not print, or does not want one we do, saves a
-- template of its own here; a firm with no row in this table gets the
-- built-in default, which is the certificate that has always been
-- printed. Nothing changes for anyone who never opens the editor.
--
-- The layout is stored as JSON rather than a row per field. It is read
-- whole, written whole, and only ever edited by the firm that owns it —
-- so a table of field rows would buy ordering and integrity that the
-- document itself already has, at the cost of a join on every
-- certificate.
--
-- Safe to run twice.

create table if not exists certificate_templates (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  pathway text not null check (pathway in ('CDC','CC')),
  -- { sections: [{ heading, rows: [{ source, label, fixedValue }] }] }
  layout jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (firm_id, pathway)
);

create index if not exists certificate_templates_firm_idx on certificate_templates(firm_id);

alter table certificate_templates enable row level security;

-- A firm's own, and only a certifier's to change: the layout decides what
-- a statutory certificate says, so a client with a portal login has no
-- business reading or writing it.
drop policy if exists "certifier manage own firm certificate templates" on certificate_templates;
create policy "certifier manage own firm certificate templates" on certificate_templates for all
  using (current_app_role() = 'certifier' and firm_id = current_firm_id())
  with check (current_app_role() = 'certifier' and firm_id = current_firm_id());
