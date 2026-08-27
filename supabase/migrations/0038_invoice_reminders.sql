-- Chasing overdue invoices the way outstanding documents are chased.
--
-- Only what the sweep must remember lives here: whether the firm wants
-- it, how often, which invoices have been told to stop, and when each
-- was last chased. A bank transfer is invisible to the software — the
-- certifier marks those paid by hand — so the reminder email always
-- carries a "if you've already paid, please disregard" line, and
-- marking an invoice paid ends its reminders mid-stream.

alter table firms add column if not exists invoice_reminders_enabled boolean not null default true;
alter table firms add column if not exists invoice_reminder_days int not null default 7
  check (invoice_reminder_days between 1 and 90);

alter table invoices add column if not exists reminders_paused boolean not null default false;
alter table invoices add column if not exists last_payment_reminder_at timestamptz;
