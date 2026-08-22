import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatISODate } from "@/lib/business";
import { signPathwayCertificate, uploadPathwayApproval } from "@/lib/actions/jobs";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { DocumentHeader } from "@/components/certifier/DocumentHeader";
import { getPathwayCertificateData, formatAddress, formatBcaVersion, formatCurrency } from "@/lib/certificates/pathwayData";

// Every field row on the certificate/notice is a real table row (not a
// flex row) so the two-column layout also comes out right in the Word
// export, which has no flexbox support at all.
function CertRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr className="align-top">
      <td className="py-1.5 pr-4 text-sm font-semibold text-slate-800 whitespace-nowrap w-1/3">{label}</td>
      <td className="py-1.5 text-sm text-slate-700">{value || "—"}</td>
    </tr>
  );
}

function TableSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={2} className="pb-1.5 pt-3 text-sm font-bold border-b border-slate-300">
        {children}
      </td>
    </tr>
  );
}

function Section({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`bg-white p-8 mb-6 shadow-sm print:shadow-none print:mb-0 ${!last ? "print:break-after-page" : ""}`} data-page-break={!last ? "after" : undefined}>
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
    <table className="w-full text-[11px] text-slate-400 border-t border-slate-200 mt-6 pt-2">
      <tbody>
        <tr>
          <td>Project No.: {projRef}</td>
          <td className="text-right">{website}</td>
        </tr>
      </tbody>
    </table>
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
        <img src={signatureUrl} alt="Signature" className="h-20 mb-1" />
      </div>
    );
  }
  return <div className={`${topPadding} h-20`} />;
}

export default async function PathwayCertificatePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getPathwayCertificateData(jobId, profile.firm_id);
  if (!data) notFound();
  const {
    job,
    firm,
    issuedBy,
    conditions,
    allItems,
    selectedInspections,
    activeVersionId,
    signatureUrl,
    uploadedApprovalUrl,
    logoUrl,
    lapseDate,
    ref,
    projRef,
    isCdc,
    pathwayFull,
    d,
    cd,
    issuedDate,
    applicantName,
    applicantPhone,
    ownerName,
    ownerAddress,
    ownerPhone,
    councilBody,
    applicantBody,
    requiredDocsList,
  } = data;

  return (
    <CertificatePackage
      backHref={`/jobs/${jobId}?tab=pathway`}
      wordExportHref={`/api/certificate/pathway/${jobId}/word`}
      signed={!!job.pathway_signed_at}
      signedLabel={`Signed ${formatISODate(job.pathway_signed_at)}`}
      signAction={signPathwayCertificate}
      signFields={{ job_id: jobId }}
      uploadAction={activeVersionId ? uploadPathwayApproval : undefined}
      uploadFields={activeVersionId ? { job_id: jobId, version_id: activeVersionId } : undefined}
      uploadPathPrefix={`${profile.firm_id}/${jobId}/certificates/pathway/${activeVersionId || "current"}`}
      uploadedUrl={uploadedApprovalUrl}
    >
      <div className="max-w-3xl mx-auto px-4 pb-10 print:px-0 print:max-w-none">
        <div className="text-xs text-slate-400 px-2 pb-2 print:hidden">
          1. Council letter · 2. Applicant letter · 3. Certificate · 4. Certificate (cont.) · 5. Mandatory inspections notice · 6. Checklist summary
        </div>
        {!issuedBy && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mx-2 mb-3 print:hidden">
            No certifier is recorded as having issued this version — the certifier&apos;s name, registration details, and signature will show as blank on
            every page below. Re-issue or regenerate the certificate and select a certifier.
          </div>
        )}
        {issuedBy && job.pathway_signed_at && !issuedBy.signature_url && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mx-2 mb-3 print:hidden">
            Signed, but {issuedBy.name} has no signature image on file — the signature line will stay blank. Upload one in Settings → Certifiers.
          </div>
        )}

        {/* 1. Council letter */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          <div className="text-sm space-y-3">
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
              <div>
                <strong>Re:</strong> {job.address}
              </div>
              <div className="mt-2">
                <strong>{pathwayFull} No.</strong>&nbsp;&nbsp;{ref}
              </div>
              <div className="mt-1">
                {isCdc ? (
                  <>
                    <strong>Planning Instrument Decision Made Under:</strong>&nbsp;&nbsp;{cd.relevantInstrument || "—"}
                  </>
                ) : (
                  <>
                    <strong>Development Application No.:</strong>&nbsp;&nbsp;{cd.developmentConsentNumber || "—"}
                  </>
                )}
              </div>
            </div>
            {councilBody.map((para, i) => (
              <div key={i} className="whitespace-pre-line">
                {para}
              </div>
            ))}
            <div>
              Please find enclosed the following documentation:
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>{pathwayFull} No. {ref}</li>
                <li>Copy of the application for the {pathwayFull}.</li>
                <li>Documentation used to determine the application for the {pathwayFull} as detailed in Schedule 1 of the Certificate.</li>
              </ul>
            </div>
            <div className="pt-4">Yours sincerely,</div>
            <SignatureLine signatureUrl={signatureUrl} topPadding="pt-6" />
            <div>{issuedBy?.name || "—"}</div>
            <div className="text-xs text-slate-500">Registered Certifier / {issuedBy?.registration_no}</div>
            <div className="text-xs text-slate-500">{firm?.name} Pty Ltd</div>
          </div>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>

        {/* 2. Applicant letter */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          <div className="text-sm space-y-3">
            <RefDateRow projRef={projRef} date={issuedDate} />
            <div>
              {applicantName}
              <br />
              {formatAddress(d.applicantAddress)}
            </div>
            <div>Dear Sir/Madam,</div>
            <div>
              <div>
                <strong>Re:</strong> {job.address}
              </div>
              <div className="mt-2">
                <strong>{pathwayFull} No.:</strong>&nbsp;&nbsp;{ref}
              </div>
            </div>
            <div className="font-bold">
              Enclosed is a copy of the approved {pathwayFull} for the subject development, and a copy of the stamped plans.
            </div>
            {applicantBody.map((para, i) => (
              <div key={i} className="whitespace-pre-line">
                {para}
              </div>
            ))}
            <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
              Please note that to accept the Notice of Appointment of Principal Certifier and Commencement of Building Work, you must provide:
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {requiredDocsList.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="pt-4">Yours sincerely,</div>
            <SignatureLine signatureUrl={signatureUrl} topPadding="pt-6" />
            <div>{issuedBy?.name || "—"}</div>
            <div className="text-xs text-slate-500">Registered Certifier / {issuedBy?.registration_no}</div>
            <div className="text-xs text-slate-500">{firm?.name} Pty Ltd</div>
          </div>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>

        {/* 3. Certificate */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          {isCdc ? (
            <>
              <div className="text-sm font-bold uppercase">
                {pathwayFull} {ref}
                <br />
                PROJECT REFERENCE {projRef}
              </div>
              <p className="text-xs text-slate-500 mt-1 mb-4">Issued under Part 4, Division 4.5 of the Environmental Planning and Assessment Act 1979</p>
              <p className="text-sm font-bold mb-4">
                This CDC approval does not allow any work to commence. Principal Certifier must be appointed, and Home Building Compensation Fund (HBCF)
                has been issued by a licenced builder or Owner Builder Permit is issued by Building Commission NSW and all council fees/bonds have been
                paid.
              </p>
            </>
          ) : (
            <>
              <div className="text-sm font-bold uppercase">
                {pathwayFull} &ndash; {projRef}
              </div>
              <p className="text-xs text-slate-500 mt-1 mb-4">Issued under Part 6 the Environmental Planning and Assessment Act 1979</p>
              <p className="text-sm font-bold mb-4">
                This Construction Certificate does not give authorisation of any construction works to commence until a Principal Certifier has been
                appointed.
              </p>
            </>
          )}

          <table className="w-full">
            <tbody>
              <TableSectionHeading>APPLICANT DETAILS</TableSectionHeading>
              <CertRow label="Applicant:" value={applicantName} />
              <CertRow label="Address:" value={formatAddress(d.applicantAddress)} />
              <CertRow label="Phone:" value={applicantPhone} />

              <TableSectionHeading>OWNER DETAILS</TableSectionHeading>
              <CertRow label={isCdc ? "Owner" : "Owner:"} value={ownerName} />
              <CertRow label="Address:" value={ownerAddress} />
              <CertRow label="Phone:" value={ownerPhone} />

              {isCdc ? (
                <>
                  <TableSectionHeading>{pathwayFull.toUpperCase()} DETAILS</TableSectionHeading>
                  <CertRow label="NSW Planning Portal Ref Number:" value={cd.planningPortalRef} />
                  <CertRow label="Local Government Area:" value={d.council?.lga} />
                  <CertRow label="Relevant Environmental Planning Instrument" value={cd.relevantInstrument} />
                  <CertRow label="Relevant Part of Code" value={cd.relevantPartOfCode} />
                  <CertRow label="Date of Determination:" value={formatISODate(cd.determinationDate)} />
                  <CertRow label="Date of Lapse:" value={/^\d{4}-\d{2}-\d{2}$/.test(lapseDate) ? formatISODate(lapseDate) : lapseDate} />
                </>
              ) : (
                <>
                  <TableSectionHeading>RELEVANT DEVELOPMENT CONSENTS</TableSectionHeading>
                  <CertRow label="Consent Authority / Local Government Area:" value={d.council?.lga} />
                  <CertRow label="Development Consent Number:" value={cd.developmentConsentNumber} />
                  <CertRow label="Development Consent Date:" value={formatISODate(cd.developmentConsentDate)} />
                  <CertRow label="NSW Planning Portal Ref Number:" value={cd.planningPortalRef} />
                  <CertRow label="Construction Certificate Number:" value={ref} />
                  <CertRow label="Date of Issue of Construction Certificate:" value={issuedDate} />
                </>
              )}

              <TableSectionHeading>PROPOSAL</TableSectionHeading>
              <CertRow label="Address of Development:" value={job.address} />
              <CertRow label={isCdc ? "Lot/Section/DP:" : "Lot/ DP:"} value={cd.lotSectionDp} />
              {isCdc && <CertRow label="Land Use Zone:" value={d.zoning} />}
              <CertRow label={isCdc ? "BCA Classification/s:" : "BCA Classification:"} value={(d.proposal?.classifications || []).join(", ")} />
              <CertRow label="BCA/NCC Version:" value={formatBcaVersion(d.bcaVersion, d.bcaVolumes)} />
              <CertRow label="Description of Building Works:" value={job.description} />
              <CertRow
                label={isCdc ? "Value of Construction (incl. GST):" : "Value of Construction Certificate (incl. GST)"}
                value={formatCurrency(d.proposal?.estimatedCost)}
              />
              <CertRow label={isCdc ? "Attachments" : "Attachments:"} value="Schedule 1: Approved Plans and Specifications and Supporting Documentation Relied Upon" />
              {isCdc && (
                <tr className="align-top">
                  <td className="py-1.5 pr-4 text-sm font-semibold text-slate-800 whitespace-nowrap w-1/3">Conditions:</td>
                  <td className="py-1.5 text-sm text-slate-700">
                    <div>
                      Conditions under the Environmental Planning and Assessment Regulation 2021 and State Environmental Planning Policy (Exempt and
                      Complying Development) Codes 2008 &amp; State Environmental Planning Policy (Housing) 2021
                    </div>
                    <div className="mt-1">
                      Any monetary contribution fee&rsquo;s and/or any other Council fee&rsquo;s/bonds that are required by council MUST be paid prior to
                      commencement of building works. A receipt is to be sent to the PC. Any works in council property MUST have prior approval from
                      Council and a copy of such approval provided to the PC prior to the works commencing.
                    </div>
                    {(conditions || []).length > 0 && (
                      <ul className="list-disc pl-4 mt-2 space-y-0.5">
                        {(conditions || []).map((c) => (
                          <li key={c.id}>{c.text}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              )}
              <CertRow label={isCdc ? "Critical stage inspections:" : "Critical Stage Inspections:"} value="See attached Notice" />
            </tbody>
          </table>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>

        {/* 3b. Certificate — certifying authority, declaration & signature */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          <div className="text-xs text-slate-400 mb-3">
            {pathwayFull} {ref} — continued
          </div>
          {/* Registration body then number, in that order and never split
              across a page — read together they're one statement of the
              authority the certificate is issued under. */}
          <table className="w-full break-inside-avoid">
            <tbody>
              <TableSectionHeading>REGISTERED CERTIFIER</TableSectionHeading>
              <CertRow label="Registered Certifier:" value={issuedBy?.name} />
              <CertRow label="Registration Body:" value={issuedBy?.registration_body} />
              <CertRow label="Registration No:" value={issuedBy?.registration_no} />
            </tbody>
          </table>

          <p className="text-sm mt-4 text-justify">
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

        {/* 4. Mandatory inspections notice */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          <div className="text-sm space-y-3">
            <div className="text-base font-bold">NOTICE TO APPLICANT OF MANDATORY CRITICAL STAGE INSPECTIONS</div>
            <div className="text-xs text-slate-500">
              Made under Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 — Section 58
            </div>

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
              I, {issuedBy?.name || "—"} of {firm?.name} Pty Ltd, located at {firm?.office_address}, acting as the principal certifier, hereby give notice
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
            <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
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
            <div className="text-xs text-slate-500">Principal Certifier / {issuedBy?.registration_no}</div>
          </div>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>

        {/* 4b. Schedule 1 — the schedule the notice refers to, on its own
            page so it can be handed to the builder as a standalone list of
            the inspections to book. */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          <div className="text-sm space-y-3">
            <div className="font-bold text-base mb-1">SCHEDULE 1: MANDATORY CRITICAL STAGE INSPECTIONS</div>
            <div className="text-xs text-slate-500">
              {pathwayFull} {ref} — {job.address}
            </div>
            <table className="w-full border border-slate-300 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-1.5 w-10 text-left">No.</th>
                  <th className="border border-slate-300 px-3 py-1.5 text-left">Critical Stage Inspection</th>
                  <th className="border border-slate-300 px-3 py-1.5 w-56 text-left">Inspector</th>
                </tr>
              </thead>
              <tbody>
                {selectedInspections.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="border border-slate-300 px-3 py-1.5">{idx + 1}.</td>
                    <td className="border border-slate-300 px-3 py-1.5">{r.stage}</td>
                    <td className="border border-slate-300 px-3 py-1.5">{r.inspector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>

        {/* 5. Checklist summary */}
        <Section last>
          <div className="text-sm">
            <div className="text-base font-bold mb-1">DOCUMENTS REQUESTED — {job.pathway} CHECKLIST</div>
            <div className="text-xs text-slate-500 mb-3">Every document requested from the applicant during assessment, for reference.</div>
            <table className="w-full border border-slate-300 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-1.5 w-32 text-left">Prepared by</th>
                  <th className="border border-slate-300 px-3 py-1.5 text-left">Document</th>
                  <th className="border border-slate-300 px-3 py-1.5 w-28 text-left">Reference no.</th>
                  <th className="border border-slate-300 px-3 py-1.5 w-20 text-left">Revision</th>
                  <th className="border border-slate-300 px-3 py-1.5 w-24 text-left">Date</th>
                  <th className="border border-slate-300 px-3 py-1.5 w-24 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((i) => (
                  <tr key={i.id}>
                    <td className="border border-slate-300 px-3 py-1.5">{i.prepared_by || "—"}</td>
                    <td className="border border-slate-300 px-3 py-1.5">{i.title}</td>
                    <td className="border border-slate-300 px-3 py-1.5">{i.drawing_number || "—"}</td>
                    <td className="border border-slate-300 px-3 py-1.5">{i.revision || "—"}</td>
                    <td className="border border-slate-300 px-3 py-1.5">{formatISODate(i.document_date)}</td>
                    <td className="border border-slate-300 px-3 py-1.5 capitalize">{i.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </CertificatePackage>
  );
}
