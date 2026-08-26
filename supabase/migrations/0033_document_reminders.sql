-- Automatic document chasing.
--
-- The checklists already know exactly what each client still owes; the
-- reminder emails write themselves from that. What the database needs to
-- keep is only the judgement around them: whether a firm wants them at
-- all, how often, which jobs have been told to stop, and when each job's
-- client was last chased — so a daily check can decide "is it time" and
-- a certifier can see at a glance that the chasing is happening.

-- On by default: the emails only ever go to clients who owe documents,
-- and every job can be paused individually.
alter table firms add column if not exists document_reminders_enabled boolean not null default true;
alter table firms add column if not exists document_reminder_days int not null default 7
  check (document_reminder_days between 1 and 90);

alter table jobs add column if not exists document_reminders_paused boolean not null default false;
alter table jobs add column if not exists last_document_reminder_at timestamptz;
