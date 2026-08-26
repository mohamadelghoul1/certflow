-- The company's own NSW Planning Portal account.
--
-- Most firms report everything through one Portal login. Recorded once
-- in Firm details, it is offered automatically on every inspection
-- report; a certifier with their own Portal account (a contractor, say)
-- can still carry one on their own row, which wins for their
-- inspections.

alter table firms
  add column if not exists portal_email text;
