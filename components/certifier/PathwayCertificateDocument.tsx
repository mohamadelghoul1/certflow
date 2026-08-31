import { formatDocumentDate, formatISODate } from "@/lib/business";
import { DocumentHeader } from "@/components/certifier/DocumentHeader";
import { PreInspectionReportBody } from "@/components/certifier/PreInspectionReportBody";
import type { PreInspectionData } from "@/lib/certificates/preInspectionData";
import { LetterBodyEditor } from "@/components/certifier/LetterBodyEditor";
import { EditableDocText } from "@/components/certifier/EditableDocText";
import { formatAddress, type PathwayCertificateData } from "@/lib/certificates/pathwayData";
import { Fragment } from "react";
import { resolveTemplate } from "@/lib/certificates/certificateTemplate";
import { certificateFieldValues } from "@/lib/certificates/certificateValues";
import { writeKey } from "@/lib/certificates/docKeys";
import type { FieldKey } from "@/lib/certificates/templateFields";

// The CDC/CC package as it appears on screen and, more importantly, as it
// comes out of the browser's print dialog.
//
// Kept separate from the page that fetches it so the printed pagination
// can be checked the way the Word and PDF versions are — rendered from a
// fixture and measured — rather than eyeballed against a live job. Each
// section is a page, so what matters here is that every one of them
// actually fits on one.

// Every field row on the certificate/notice is a real table row (not a
// flex row) so the two-column layout also comes out right in the Word
// export, which has no flexbox support at all.
function CertRow({
  label,
  value,
  wideLabel,
  jobId,
  docKey,
  overrides,
  multiline,
}: {
  label: string;
  value?: string | null;
  wideLabel?: boolean;
  // Given a job and a key, the value becomes editable in place and the
  // wording typed here is what prints. Left out, the row is read-only —
  // used for the covering letters' certificate-number rows, which must
  // agree with the certificate itself.
  jobId?: string;
  docKey?: string;
  overrides?: Record<string, string>;
  multiline?: boolean;
}) {
  const override = docKey ? overrides?.[docKey] : undefined;
  const shown = (override ?? value) || "";
  return (
    <tr className="align-top">
      {/* Right-aligned against its value, the shape every field takes in
          the Word export and the approved-set PDF (fieldRow / fieldTable).
          wideLabel is for the covering letters, whose labels are sentences
          rather than the certificate's one-word "Applicant:". */}
      <td className={`py-1 pr-3 text-sm font-semibold text-heading text-right align-top ${wideLabel ? "w-[42%] whitespace-nowrap" : "w-[32%]"}`}>{label}</td>
      <td className="py-1 text-sm text-heading">
        {jobId && docKey ? (
          <EditableDocText
            jobId={jobId}
            docKey={docKey}
            value={shown || "—"}
            overridden={!!override}
            label={label}
            as={multiline ? "paragraphs" : "inline"}
            rows={multiline ? 4 : 2}
          />
        ) : (
          shown || "—"
        )}
      </td>
    </tr>
  );
}

function TableSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={2} className="pb-1 pt-4 text-sm font-bold uppercase text-doc-heading border-b border-line">
        {children}
      </td>
    </tr>
  );
}

// `letter` marks the two covering letters. They are prose on a mostly
// empty page rather than a dense form, so they print at the same 11pt the
// Word export and the PDF approved set set them in — the compact size the
// rest of the pack needs to hold its pagination reads far too small in a
// letter. See the .letter-page block in globals.css.
function Section({ children, last, letter }: { children: React.ReactNode; last?: boolean; letter?: boolean }) {
  return (
    <div
      className={`cert-page bg-white p-8 mb-6 shadow-sm print:shadow-none print:mb-0 print:py-[12mm] print:px-[14mm] ${letter ? "letter-page" : ""} ${!last ? "print:break-after-page" : ""}`}
      data-page-break={!last ? "after" : undefined}
    >
      {children}
    </div>
  );
}

// Our own footer (project number + firm website) — separate from, and no
// substitute for, the browser's own print header/footer (page title + URL,
// date/time), which the page itself has no way to turn off. That's a
// setting in the print dialog (see "More settings" → uncheck "Headers and
// footers"), not something CSS or JS on the page can control.
function DocFooter({ projRef, website }: { projRef: string; website?: string | null }) {
  return (
    <table className="doc-footer w-full text-[11px] text-placeholder border-t border-line mt-6 pt-2">
      <tbody>
        <tr>
          <td>Project No.: {projRef}</td>
          <td className="text-right">{website}</td>
        </tr>
      </tbody>
    </table>
  );
}

// The letters borrow the certificate's two devices: a ruled heading, and
// right-of-label fields. Run on as bold-lead paragraphs, a letter's
// subject and references read as three ragged lines of small print; set
// like this they read as the same document as the certificate behind them.
function LetterHeading({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-bold uppercase text-doc-heading border-b border-line pb-1.5">{children}</div>;
}

function LetterFields({ children }: { children: React.ReactNode }) {
  return (
    <table className="w-full">
      <tbody>{children}</tbody>
    </table>
  );
}

// The title at the head of a document section — the certificate, the
// notice, a schedule. Matches documentTitle() in lib/docx/shared.ts and
// lib/pdf/layout.ts: the title in navy, its small print under it, and a
// rule closing the block.
function DocTitle({ title, subtitles = [] }: { title: string; subtitles?: (string | null | undefined)[] }) {
  const lines = subtitles.filter(Boolean) as string[];
  return (
    <div className="border-b border-line pb-1.5 mb-3">
      <div className="text-base font-bold uppercase text-doc-heading">{title}</div>
      {lines.map((line) => (
        <div key={line} className="text-xs text-muted mt-0.5">
          {line}
        </div>
      ))}
    </div>
  );
}

// A real table for the reference/date line too — a flex row would just
// stack in Word instead of showing the date on the right.
function RefDateRow({ projRef, date }: { projRef: string; date: string }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr>
          <td>Our reference: {projRef}</td>
          <td className="text-right">{date}</td>
        </tr>
      </tbody>
    </table>
  );
}

// No ruled line under the signature: an empty "sign here" rule reads as an
// unfinished form field once a real signature is already sitting on top of
// it. Unsigned, this is just the blank vertical gap the signature will fill
// once the document is signed.
function SignatureLine({ signatureUrl, topPadding }: { signatureUrl: string | null; topPadding: string }) {
  if (signatureUrl) {
    return (
      <div className={topPadding}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signatureUrl} alt="Signature" className="h-20 print:h-11 mb-1" />
      </div>
    );
  }
  return <div className={`${topPadding} h-20 print:h-11`} />;
}

export function PathwayCertificateDocument({ data, preInspection }: { data: PathwayCertificateData; preInspection?: PreInspectionData | null }) {
  const {
    job,
    firm,
    issuedBy,
    conditions,
    allItems,
    selectedInspections,
    signatureUrl,
    logoUrl,
    ref,
    projRef,
    isCdc,
    pathwayFull,
    letterCertLabel,
    d,
    cd,
    issuedDate,
    applicantName,
    applicantPhone,
    councilBody,
    applicantBody,
    requiredDocsList,
  } = data;

  // Wording this job has overridden, and the standard conditions text the
  // conditions block falls back to. Any field carrying a docKey shows the
  // override when there is one, so a certifier can correct a line on the
  // certificate itself without the underlying project record shifting
  // under the register or Schedule 1.
  const docOverrides = d.docOverrides || {};
  const standardConditions = [
    "Conditions under the Environmental Planning and Assessment Regulation 2021 and State Environmental Planning Policy (Exempt and Complying Development) Codes 2008 & State Environmental Planning Policy (Housing) 2021",
    "Any monetary contribution fee\u2019s and/or any other Council fee\u2019s/bonds that are required by council MUST be paid prior to commencement of building works. A receipt is to be sent to the PC. Any works in council property MUST have prior approval from Council and a copy of such approval provided to the PC prior to the works commencing.",
    ...(conditions || []).map((c) => c.text),
  ].join("\n\n");

  return (
    <div className="cert-doc max-w-3xl mx-auto px-4 pb-10 print:px-0 print:pb-0 print:max-w-none">
      <div className="text-xs text-placeholder px-2 pb-2 print:hidden">
        1. Council letter · 2. Applicant letter · 3. Certificate · 4. Certificate (cont.) · 5. Mandatory inspections notice · 6. Checklist summary
      </div>
      {!issuedBy && (
        <div className="text-xs text-error bg-error-bg border border-error/40 rounded-md px-3 py-2 mx-2 mb-3 print:hidden">
          No certifier is recorded as having issued this version — the certifier&apos;s name, registration details, and signature will show as blank on
          every page below. Re-issue or regenerate the certificate and select a certifier.
        </div>
      )}
      {issuedBy && job.pathway_signed_at && !issuedBy.signature_url && (
        <div className="text-xs text-warning-text bg-warning-bg border border-warning/50 rounded-md px-3 py-2 mx-2 mb-3 print:hidden">
          Signed, but {issuedBy.name} has no signature image on file — the signature line will stay blank. Upload one in Settings → Certifiers.
        </div>
      )}

      {/* 1. Council letter */}
      <Section letter>
        <DocumentHeader firm={firm} logoUrl={logoUrl} />
        <div className="letter-body text-sm space-y-3">
          <RefDateRow projRef={projRef} date={issuedDate} />
          <div>
            The General Manager
            <br />
            {d.council?.lga || "Council"}
            <br />
            {formatAddress(d.council?.address)}
          </div>
          <div>Dear Sir/Madam,</div>
          <div>
            <LetterHeading>Re: {job.address}</LetterHeading>
            <LetterFields>
              <CertRow label={letterCertLabel} value={ref} wideLabel />
              {isCdc ? (
                <CertRow label="Planning Instrument Decision Made Under:" value={cd.relevantInstrument} wideLabel />
              ) : (
                <CertRow label="Development Application No.:" value={cd.developmentConsentNumber} wideLabel />
              )}
            </LetterFields>
          </div>
          <LetterBodyEditor jobId={job.id} letter="council" paragraphs={councilBody} hasOverride={!!job.council_letter_override} />
          <div>
            <LetterHeading>Enclosed with this letter</LetterHeading>
            <ul className="list-disc pl-5 mt-2 space-y-0.5">
              <li>{pathwayFull} No. {ref}</li>
              <li>Copy of the application for the {pathwayFull}.</li>
              <li>Documentation used to determine the application for the {pathwayFull} as detailed in Schedule 1 of the Certificate.</li>
            </ul>
          </div>
          <div className="pt-4">Yours sincerely,</div>
          <SignatureLine signatureUrl={signatureUrl} topPadding="pt-6" />
          <div>{issuedBy?.name || "—"}</div>
          <div className="text-xs text-placeholder">Registered Certifier / {issuedBy?.registration_no}</div>
          <div className="text-xs text-placeholder">{firm?.name}</div>
        </div>
        <DocFooter projRef={projRef} website={firm?.website} />
      </Section>

      {/* 2. Applicant letter */}
      <Section letter>
        <DocumentHeader firm={firm} logoUrl={logoUrl} />
        <div className="letter-body text-sm space-y-3">
          <RefDateRow projRef={projRef} date={issuedDate} />
          <div>
            {applicantName}
            <br />
            {formatAddress(d.applicantAddress)}
          </div>
          <EditableDocText
            jobId={job.id}
            docKey="applicant.salutation"
            value={docOverrides["applicant.salutation"] ?? "Dear Sir/Madam,"}
            overridden={!!docOverrides["applicant.salutation"]}
            label="the greeting"
            as="inline"
            rows={2}
          />
          <div>
            <LetterHeading>Re: {job.address}</LetterHeading>
            <LetterFields>
              <CertRow label={letterCertLabel} value={ref} wideLabel />
            </LetterFields>
          </div>
          <EditableDocText
            jobId={job.id}
            docKey="applicant.intro"
            value={
              docOverrides["applicant.intro"] ??
              `Enclosed is a copy of the approved ${pathwayFull} for the subject development, and a copy of the stamped plans.`
            }
            overridden={!!docOverrides["applicant.intro"]}
            label="the opening line"
            className="font-bold"
            rows={3}
          />
          <LetterBodyEditor jobId={job.id} letter="applicant" paragraphs={applicantBody} hasOverride={!!job.applicant_letter_override} />
          <div className="bg-warning-bg border border-warning/50 rounded-md px-4 py-3">
            <EditableDocText
              jobId={job.id}
              docKey="applicant.requirementsIntro"
              value={
                docOverrides["applicant.requirementsIntro"] ??
                "Please note that to accept the Notice of Appointment of Principal Certifier and Commencement of Building Work, you must provide:"
              }
              overridden={!!docOverrides["applicant.requirementsIntro"]}
              label="the requirements introduction"
              as="inline"
              rows={3}
            />
            <EditableDocText
              jobId={job.id}
              docKey="applicant.requirements"
              value={docOverrides["applicant.requirements"] ?? requiredDocsList.join("\n")}
              overridden={!!docOverrides["applicant.requirements"]}
              label="the list of requirements"
              as="lines"
              rows={6}
            />
          </div>
          <EditableDocText
            jobId={job.id}
            docKey="applicant.closing"
            value={docOverrides["applicant.closing"] ?? "Yours sincerely,"}
            overridden={!!docOverrides["applicant.closing"]}
            label="the sign-off"
            as="inline"
            className="pt-4"
            rows={2}
          />
          <SignatureLine signatureUrl={signatureUrl} topPadding="pt-6" />
          <div>{issuedBy?.name || "—"}</div>
          <div className="text-xs text-placeholder">Registered Certifier / {issuedBy?.registration_no}</div>
          <div className="text-xs text-placeholder">{firm?.name}</div>
        </div>
        <DocFooter projRef={projRef} website={firm?.website} />
      </Section>

      {/* 3. Certificate */}
      <Section>
        <DocumentHeader firm={firm} logoUrl={logoUrl} />
        {isCdc ? (
          <>
            <DocTitle
              title={`${pathwayFull} ${ref}`}
              subtitles={["Issued under Part 4, Division 4.5 of the Environmental Planning and Assessment Act 1979"]}
            />
            <p className="text-sm font-bold mb-4">
              This CDC approval does not allow any work to commence. Principal Certifier must be appointed, and Home Building Compensation Fund (HBCF)
              has been issued by a licenced builder or Owner Builder Permit is issued by Building Commission NSW and all council fees/bonds have been
              paid.
            </p>
          </>
        ) : (
          <>
            <DocTitle title={`${pathwayFull} – ${projRef}`} subtitles={["Issued under Part 6 the Environmental Planning and Assessment Act 1979"]} />
            <p className="text-sm font-bold mb-4">
              This Construction Certificate does not give authorisation of any construction works to commence until a Principal Certifier has been
              appointed.
            </p>
          </>
        )}

        <table className="w-full">
          <tbody>
            {/* Drawn from the firm's own layout where they have saved one,
                Certlyn's otherwise — the same layout the PDF and the Word
                export walk, so what is edited here is what is issued. */}
            {resolveTemplate(data.template, certificateFieldValues(data), pathwayFull).map((section) => (
              <Fragment key={section.heading}>
                {section.heading && <TableSectionHeading>{section.heading}</TableSectionHeading>}
                {section.rows.map((row, i) =>
                  row.kind === "conditions" ? (
                    <tr key={`${row.key}-${i}`} className="align-top">
                      <td className="py-1.5 pr-4 text-sm font-semibold text-heading whitespace-nowrap w-1/3">{row.label}</td>
                      <td className="py-1.5 text-sm text-muted">
                        <EditableDocText
                          jobId={job.id}
                          docKey="cert.conditions"
                          value={docOverrides["cert.conditions"] ?? standardConditions}
                          overridden={!!docOverrides["cert.conditions"]}
                          label="the conditions"
                          rows={8}
                          className="space-y-1"
                        />
                      </td>
                    </tr>
                  ) : (
                    <CertRow
                      key={`${row.key}-${i}`}
                      label={row.label}
                      value={row.value}
                      jobId={job.id}
                      // A row of the firm's own wording has nothing behind
                      // it to correct per job — it says the same thing on
                      // every certificate, and is changed in Settings.
                      docKey={row.key === "fixed" ? undefined : writeKey(row.key as FieldKey)}
                      overrides={docOverrides}
                    />
                  ),
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        <DocFooter projRef={projRef} website={firm?.website} />
      </Section>

      {/* 3b. Certificate — declaration & signature */}
      <Section>
        <DocumentHeader firm={firm} logoUrl={logoUrl} />
        <div className="text-xs text-placeholder mb-3">
          {pathwayFull} {ref} — continued
        </div>
        <p className="text-sm text-justify">
          {isCdc ? (
            <>
              I, {issuedBy?.name || "—"}, certify that the development is complying development and (if carried out as specified in the certificate)
              will comply with all development standards applicable to the development and with such other requirements prescribed by this regulation
              concerning the issue of the certificate.
            </>
          ) : (
            <>
              I certify that building work completed in accordance with the documents accompanying the application for the certificate, including
              modifications verified by the certifier shown on the documents, will comply with the requirements referred to in the Act, Part 6.
            </>
          )}
        </p>

        <table className="w-full text-sm mt-4">
          <tbody>
            <tr>
              <td>Dated:</td>
              <td>{issuedDate}</td>
            </tr>
          </tbody>
        </table>
        <SignatureLine signatureUrl={signatureUrl} topPadding="pt-4" />
        <div className="text-sm">{issuedBy?.name || "—"}</div>

        <p className="text-sm font-bold mt-6">
          {isCdc
            ? "N.B. Prior to the commencement of work section 6.6 of the Environment Planning and Assessment Act 1979 must be satisfied."
            : "N.B Prior to the commencement of work Sections 4.19, 6.6, 6.7, 6.12, 6.13, 6.14 of the Environment Planning and Assessment Act 1979 must be satisfied."}
        </p>
        <DocFooter projRef={projRef} website={firm?.website} />
      </Section>

      {/* 4. Schedule 1 to the certificate: the documents it relies on.
          Sits directly under the certificate it belongs to, rather than
          at the back of the pack behind the inspections notice. */}
      <Section>
        <DocumentHeader firm={firm} logoUrl={logoUrl} />
        <div className="text-sm">
          <DocTitle title="SCHEDULE 1: APPROVED PLANS AND SPECIFICATIONS/ SUPPORTING DOCUMENTATION RELIED UPON" />
          <table className="w-full border border-line text-sm">
            <thead>
              <tr className="bg-surface">
                <th className="border border-line px-3 py-1.5 w-32 text-left">Prepared by</th>
                <th className="border border-line px-3 py-1.5 text-left">Document</th>
                <th className="border border-line px-3 py-1.5 w-28 text-left">Reference no.</th>
                <th className="border border-line px-3 py-1.5 w-20 text-left">Revision</th>
                <th className="border border-line px-3 py-1.5 w-24 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((i) => (
                <tr key={i.id}>
                  <td className="border border-line px-3 py-1.5">{i.prepared_by || "—"}</td>
                  <td className="border border-line px-3 py-1.5">{i.title}</td>
                  <td className="border border-line px-3 py-1.5">{i.drawing_number || "—"}</td>
                  <td className="border border-line px-3 py-1.5">{i.revision || "—"}</td>
                  <td className="border border-line px-3 py-1.5">{formatDocumentDate(i.document_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DocFooter projRef={projRef} website={firm?.website} />
      </Section>

      {/* 4b. Pre-inspection report — s139 for a CDC, s16 for a CC. It
          sits under the certificate and its Schedule 1, before the
          inspections notice, because it is what was found on site before
          the certificate was issued rather than part of the notice of
          what is still to be inspected. Absent until the certifier has
          recorded the dates it needs. */}
      {preInspection && (
        <Section>
          <PreInspectionReportBody data={preInspection} />
        </Section>
      )}

      {/* 5. Mandatory inspections notice */}
      <Section>
        <DocumentHeader firm={firm} logoUrl={logoUrl} />
        <div className="text-sm space-y-3">
          <DocTitle
            title="NOTICE TO APPLICANT OF MANDATORY CRITICAL STAGE INSPECTIONS"
            subtitles={["Made under Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 — Section 58"]}
          />

          <table className="w-full">
            <tbody>
              <TableSectionHeading>APPLICANT DETAILS</TableSectionHeading>
              <CertRow label="Name of the person having benefit of the Development Consent:" value={applicantName} />
              <CertRow label="Address:" value={formatAddress(d.applicantAddress)} />
              <CertRow label="Phone:" value={applicantPhone} />

              {isCdc ? (
                <>
                  <TableSectionHeading>COMPLYING DEVELOPMENT CONSENTS</TableSectionHeading>
                  <CertRow label="Consent Authority / Local Government Area:" value={d.council?.lga} />
                  <CertRow label="Decision Made Under:" value={cd.relevantInstrument} />
                  <CertRow label="CDC Number:" value={ref} />
                </>
              ) : (
                <>
                  <TableSectionHeading>RELEVANT CONSENTS</TableSectionHeading>
                  <CertRow label="Consent Authority / Local Government Area:" value={d.council?.lga} />
                  <CertRow label="Development Consent Number:" value={cd.developmentConsentNumber} />
                  <CertRow label="Date Issued:" value={formatISODate(cd.developmentConsentDate)} />
                  <CertRow label="Construction Certificate Number:" value={ref} />
                </>
              )}

              <TableSectionHeading>PROPOSAL</TableSectionHeading>
              <CertRow label="Address of Development:" value={job.address} />
              <CertRow label="Scope of Building Works Covered by this Notice:" value={job.description} />

              <TableSectionHeading>CERTIFICATION DETAILS</TableSectionHeading>
              <CertRow label="Certifying Authority:" value={issuedBy?.name} />
              <CertRow label="Registration Number:" value={issuedBy ? `${issuedBy.registration_body || ""} / ${issuedBy.registration_no || ""}` : null} />
            </tbody>
          </table>

          <div className="pt-2">
            I, {issuedBy?.name || "—"} of {firm?.name}, located at {firm?.office_address}, acting as the principal certifier, hereby give notice
            in accordance with Section 58 of the Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety)
            Regulation 2021 to the person having the benefit of the development consent that the mandatory critical stage inspections identified in
            Schedule 1 are to be carried out in respect of the building work.
          </div>
          <div>
            The applicant, being the person having benefit of the development consent, is required under Section 58 of the Environmental Planning and
            Assessment (Development Certification and Fire Safety) Regulation 2021 to notify the principal contractor (if not an owner-builder) of the
            applicable mandatory critical stage inspections specified under this notice.
          </div>
          <div>
            To allow a principal certifier or another certifying authority time to carry out mandatory critical stage inspections, the principal contractor
            for the building site, or the owner builder, must notify the principal certifier at least 48 hours before building work is commenced at the
            site if a mandatory critical stage inspection is required before the commencement of the work in accordance with Section 58 of the Environmental
            Planning and Assessment (Development Certification and Fire Safety) Regulation 2021.
          </div>
          <div className="bg-warning-bg border border-warning/50 rounded-md px-4 py-3">
            Failure to request a mandatory critical stage inspection will prohibit the principal certifier under Section 58 of the Environmental Planning
            and Assessment (Development Certification and Fire Safety) Regulation 2021 to issue an occupation certificate.
          </div>

          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td></td>
                <td className="text-right">Dated: {issuedDate}</td>
              </tr>
            </tbody>
          </table>
          <SignatureLine signatureUrl={signatureUrl} topPadding="pt-8" />
          <div>{issuedBy?.name || "—"}</div>
          <div className="text-xs text-placeholder">Principal Certifier / {issuedBy?.registration_no}</div>
        </div>
        <DocFooter projRef={projRef} website={firm?.website} />
      </Section>

      {/* 5b. Schedule 1 to the notice — the schedule it refers to, on its own
          page so it can be handed to the builder as a standalone list of
          the inspections to book. */}
      <Section last>
        <DocumentHeader firm={firm} logoUrl={logoUrl} />
        <div className="text-sm space-y-3">
          <DocTitle title="SCHEDULE 1: MANDATORY CRITICAL STAGE INSPECTIONS" subtitles={[`${pathwayFull} ${ref} — ${job.address || ""}`]} />
          <table className="w-full border border-line text-sm">
            <thead>
              <tr className="bg-surface">
                <th className="border border-line px-3 py-1.5 w-10 text-left">No.</th>
                <th className="border border-line px-3 py-1.5 text-left">Critical Stage Inspection</th>
                <th className="border border-line px-3 py-1.5 w-56 text-left">Inspector</th>
              </tr>
            </thead>
            <tbody>
              {selectedInspections.map((r, idx) => (
                <tr key={r.id}>
                  <td className="border border-line px-3 py-1.5">{idx + 1}.</td>
                  <td className="border border-line px-3 py-1.5">{r.stage}</td>
                  <td className="border border-line px-3 py-1.5">{r.inspector}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DocFooter projRef={projRef} website={firm?.website} />
      </Section>

    </div>
  );
}
