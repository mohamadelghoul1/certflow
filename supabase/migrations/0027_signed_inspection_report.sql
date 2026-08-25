-- The signed inspection report, kept as a file.
--
-- The report was rebuilt from scratch every time it was downloaded: the
-- job, the inspection, the certifier, signed links for the letterhead,
-- the signature and every photo, then the PDF itself. On a phone at the
-- end of a site visit that is a wait for something that cannot have
-- changed — a signed report is fixed until it is reopened.
--
-- So it is built once, when it is signed, and downloaded as a file
-- thereafter. Reopening it for editing clears the file, and signing again
-- writes a new one, so what downloads is always the report as signed.

alter table inspections
  add column if not exists report_pdf_path text;
