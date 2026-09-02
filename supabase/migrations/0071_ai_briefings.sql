-- The assistant's morning note, kept so it is written once, not on
-- every visit to the dashboard.
--
-- The note is drawn up from what the app already knows — which client
-- uploaded what and when, which documents are waiting on the certifier,
-- what is booked, what is overdue — and written out in plain English.
-- Writing it costs a call to the AI, so the last one is kept here with
-- a fingerprint of the facts it was written from: while nothing has
-- changed, the same note is shown again for nothing.
--
-- One row per firm. A firm's own, and only its certifiers' to see.
--
-- Safe to run twice.

create table if not exists ai_briefings (
  firm_id uuid primary key references firms(id) on delete cascade,
  headline text not null,
  points jsonb not null default '[]'::jsonb,
  facts_hash text not null,
  written text not null default 'ai',
  generated_at timestamptz not null default now()
);

alter table ai_briefings enable row level security;

drop policy if exists "certifier manage own firm briefing" on ai_briefings;
create policy "certifier manage own firm briefing" on ai_briefings for all
  using (current_app_role() = 'certifier' and firm_id = current_firm_id())
  with check (current_app_role() = 'certifier' and firm_id = current_firm_id());
