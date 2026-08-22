-- Right now the moment a CDC/CC certificate is issued or an Occupation
-- Certificate record is created, the client portal already shows a
-- "certificate issued" / OC card for it — before the certifier has had a
-- chance to review the generated document, export it to Word to fix a
-- mistake, or sign it. This adds an explicit, separate "sent to client"
-- flag so nothing appears on the portal until the certifier deliberately
-- presses "Send to client" (only available once the document is signed or
-- an already-signed copy has been uploaded).
--
-- Kept distinct from pathway_certificate_versions.visible_to_client, which
-- already means something else internally (which version is the currently
-- "active" one whose data is mirrored onto jobs.pathway_* and used
-- everywhere in the certifier UI) — reusing it for client-facing exposure
-- would have tied those two unrelated concerns together.
alter table pathway_certificate_versions add column if not exists sent_to_client boolean not null default false;
alter table pathway_certificate_versions add column if not exists sent_to_client_date date;
alter table jobs add column if not exists pathway_sent_to_client boolean not null default false;
alter table jobs add column if not exists pathway_sent_to_client_date date;

alter table oc_records add column if not exists sent_to_client boolean not null default false;
alter table oc_records add column if not exists sent_to_client_date date;

-- Existing jobs that already had an approval uploaded/visible before this
-- feature existed keep behaving the way clients have already seen them —
-- only newly issued/regenerated certificates and new OCs start out hidden.
update pathway_certificate_versions set sent_to_client = true, sent_to_client_date = approval_date where visible_to_client = true and approval_uploaded = true;
update jobs set pathway_sent_to_client = true, pathway_sent_to_client_date = pathway_approval_date where pathway_generated = true and pathway_approval_uploaded = true;
update oc_records set sent_to_client = true, sent_to_client_date = approval_date where approval_uploaded = true;

-- Enforce the same gate at the RLS layer, not just by hiding it in the
-- portal UI — a client's read access to an OC record, or to a pathway
-- certificate version row directly, now genuinely requires it to have been
-- sent, the same way every other client-facing policy in this app is
-- enforced at the database level rather than trusted to the frontend.
drop policy "client read oc_records" on oc_records;
create policy "client read oc_records" on oc_records for select
  using (current_app_role() = 'client' and sent_to_client = true and job_visible_to_client(job_id));

drop policy "client read visible pathway_certificate_versions" on pathway_certificate_versions;
create policy "client read visible pathway_certificate_versions" on pathway_certificate_versions for select
  using (current_app_role() = 'client' and visible_to_client = true and sent_to_client = true and job_visible_to_client(job_id));
