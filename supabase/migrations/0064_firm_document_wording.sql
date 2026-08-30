-- A firm's own wording for its approval documents.
--
-- Migration 0055 let a firm change the rows on its certificate. This is
-- the prose around them: the letter to the council, the letter to the
-- applicant, the same two for an Occupation Certificate, and the notice
-- about critical stage inspections.
--
-- Stored a paragraph at a time as plain text with placeholders — {FIRM},
-- {ADDRESS}, {CERTIFIER} — filled in per job when the document is made.
--
-- A firm with no row here prints exactly what it printed before this
-- existed. That is not a hope: where there is no saved wording the code
-- falls through to the default it already had, untouched.
--
-- Same shape and the same reasoning as certificate_templates: read
-- whole, written whole, and nobody's business but the firm that owns
-- it. A client with a portal login has no place reading the wording of
-- a statutory letter before it is sent, let alone changing it.
--
-- Safe to run twice.

create table if not exists firm_document_wording (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  -- 'council.body', 'applicant.body', 'oc.council.body',
  -- 'oc.applicant.body', 'inspections.notice'
  doc_key text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (firm_id, doc_key)
);

create index if not exists firm_document_wording_firm_idx on firm_document_wording(firm_id);

alter table firm_document_wording enable row level security;

drop policy if exists "certifier manage own firm document wording" on firm_document_wording;
create policy "certifier manage own firm document wording" on firm_document_wording for all
  using (current_app_role() = 'certifier' and firm_id = current_firm_id())
  with check (current_app_role() = 'certifier' and firm_id = current_firm_id());
