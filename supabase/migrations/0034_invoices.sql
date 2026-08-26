-- Invoicing.
--
-- The software has helped do the work since day one; this is the half
-- that collects for it. An invoice is its own record rather than a flag
-- on the quote, because the two live different lives: a quote can turn
-- into several invoices (a deposit, a balance, an extra inspection), an
-- imported job never had a quote at all, and an invoice's numbering and
-- totals must stay exactly as issued even when the quote is later
-- edited. Lines are copied from the quote at creation, then owned by
-- the invoice.
--
-- Status carries the invoice's life: draft (being written), sent
-- (awaiting payment), paid, void (cancelled but keeping its number —
-- tax invoice numbering shouldn't have silent gaps). "Overdue" is not a
-- status: it is simply a sent invoice past its due date, computed when
-- read, so nothing has to run at midnight to keep it true.

create table invoices (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  invoice_number text,
  status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  issue_date date not null default current_date,
  due_date date,
  -- Who the invoice is addressed to, as printed. Free text because the
  -- payer is often not a client record — a builder's accounts office,
  -- an owner's company.
  bill_to text,
  reference text,
  notes text,
  paid_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on invoices(firm_id);
create index on invoices(job_id);

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity text default '1',
  amount numeric(12,2) not null default 0,
  sort_order int not null default 0
);
create index on invoice_lines(invoice_id);

-- Certifier-only, firm-scoped — the same shape as quotes. Clients are
-- emailed their invoices; they do not browse them in the portal.
alter table invoices enable row level security;
alter table invoice_lines enable row level security;

create policy "certifier firm crud invoices" on invoices for all
  using (firm_id = current_firm_id() and current_app_role() = 'certifier')
  with check (firm_id = current_firm_id() and current_app_role() = 'certifier');
create policy "certifier firm crud invoice lines" on invoice_lines for all
  using (exists (select 1 from invoices i where i.id = invoice_id and i.firm_id = current_firm_id()) and current_app_role() = 'certifier')
  with check (exists (select 1 from invoices i where i.id = invoice_id and i.firm_id = current_firm_id()) and current_app_role() = 'certifier');
