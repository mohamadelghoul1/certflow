-- A quote number of the firm's own choosing. Left blank, the quote keeps
-- using the automatic number derived from its id, so nothing changes for
-- existing quotes.

alter table quotes
  add column if not exists quote_number text;
