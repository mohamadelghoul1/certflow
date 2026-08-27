-- The optional card surcharge (lawful until 1 October 2026; the code
-- stops applying it from that date regardless of this switch).
--
-- Off by default: adding a fee to a client's payment is the firm's
-- deliberate choice, made in Settings with the rules in front of them.
alter table firms add column if not exists card_surcharge_enabled boolean not null default false;

-- What extra the card link actually charges, kept on the invoice so the
-- books can reconcile a card payment that arrives larger than the
-- invoice's face value.
alter table invoices add column if not exists card_surcharge numeric(12,2);
