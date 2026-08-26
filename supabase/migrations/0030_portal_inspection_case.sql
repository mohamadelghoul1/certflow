-- The NSW Planning Portal's own case number for an inspection that was
-- reported through the API.
--
-- Its presence is what separates a real API submission from an
-- inspection someone marked as reported by hand: the mark can be undone,
-- the submission cannot — the Portal has the record either way.

alter table inspections
  add column if not exists portal_child_case_id text;
