-- How to pay the firm, printed on every invoice.
--
-- Entered once in Settings and copied onto each invoice at creation —
-- copied, not referenced, so an issued invoice keeps forever the bank
-- details it actually went out with, even if the firm changes banks
-- later. A draft still shows the box, so a one-off arrangement can be
-- edited before issuing.

alter table firms add column if not exists payment_details text;
alter table invoices add column if not exists payment_details text;

-- Card payments. A Stripe payment link is created per invoice on the
-- certifier's click; the id is what the webhook uses to recognise the
-- payment, the url is what the client clicks.
alter table invoices add column if not exists stripe_payment_link_id text;
alter table invoices add column if not exists stripe_payment_link_url text;
