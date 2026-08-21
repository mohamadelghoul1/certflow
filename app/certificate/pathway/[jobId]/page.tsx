import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatISODate, pathwayCertRef, calcCdcLapseDate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { signPathwayCertificate, uploadPathwayApproval } from "@/lib/actions/jobs";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { DocumentHeader } from "@/components/certifier/DocumentHeader";
import type { Job } from "@/types/db";

function formatAddress(a?: Record<string, string> | null) {
  if (!a) return "—";
  const parts = [a.streetNumber, a.street].filter(Boolean).join(" ");
  const rest = [a.suburb, a.state, a.postcode].filter(Boolean).join(" ");
  return [parts, rest].filter(Boolean).join(", ") || "—";
}

// Falls back to showing whatever was typed rather than "$NaN" if the
// estimated cost field wasn't entered as a clean number.
function formatCurrency(value?: string | null) {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? `$${parsed.toLocaleString("en-AU", { minimumFractionDigits: 2 })}` : value;
}

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

function SignatureLine({ signatureUrl, topPadding }: { signatureUrl: string | null; topPadding: string }) {
  if (signatureUrl) {
    return (
      <div className={topPadding} data-stamp>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signatureUrl} alt="Signature" className="h-14 mb-1" />
        <div className="border-b border-slate-400 w-56" />
      </div>
    );
  }
  return <div className={`${topPadding} border-b border-slate-400 w-56`} data-stamp />;
}

export default async function PathwayCertificatePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!rawJob || !rawJob.pathway_generated) notFound();
  const job = rawJob as Job;

  const [{ data: firm }, { data: conditions }, { data: issuedBy }, { data: checklists }, { data: inspections }, { data: activeVersion }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
    supabase.from("conditions_of_consent").select("*").eq("job_id", jobId).order("created_at"),
    job.pathway_issued_by ? supabase.from("certifiers").select("*").eq("id", job.pathway_issued_by).single() : Promise.resolve({ data: null }),
    supabase.from("checklists").select("id, kind, checklist_items(*)").eq("job_id", jobId),
    supabase.from("inspections").select("outcome").eq("job_id", jobId),
    supabase.from("pathway_certificate_versions").select("id").eq("job_id", jobId).eq("version", job.pathway_version).single(),
  ]);
  const signatureUrl = job.pathway_signed_at && issuedBy?.signature_url ? await signedUrl(issuedBy.signature_url) : null;
  const uploadedApprovalUrl = job.pathway_approval_uploaded ? await signedUrl(job.pathway_approval_file_path) : null;
  const logoUrl = firm?.logo_url ? await signedUrl(firm.logo_url) : null;

  const pathwayChecklist = (checklists || []).find((c) => c.kind === "pathway");
  const nocChecklist = (checklists || []).find((c) => c.kind === "noc");
  const allItems = ((pathwayChecklist?.checklist_items as never[]) || []) as {
    id: string;
    title: string;
    status: string;
    document_date: string | null;
  }[];

  const lapseDate = calcCdcLapseDate(
    job.pathway,
    job.details?.certificateDetails?.determinationDate,
    (nocChecklist?.checklist_items as never[]) || [],
    (inspections || []).map((i) => i.outcome)
  );

  const ref = pathwayCertRef(job.pathway, job.details?.projectNumber || job.id.slice(0, 8), job.pathway_version);
  const projRef = ref.split("/")[0];
  const isCdc = job.pathway === "CDC";
  const pathwayFull = isCdc ? "Complying Development Certificate" : "Construction Certificate";
  const d = job.details || {};
  const cd = d.certificateDetails || {};
  const issuedDate = formatISODate(job.pathway_generated_date);
  const applicantName = [d.contact?.title, d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ") || d.contact?.nameOrCompany || "Applicant";
  const applicantPhone = d.contact?.phone || d.contact?.mobile;
  const ownerName = d.ownerSameAsApplicant ? applicantName : d.owner?.name || applicantName;
  const ownerAddress = d.ownerSameAsApplicant ? formatAddress(d.applicantAddress) : formatAddress(d.owner?.address);
  const ownerPhone = d.ownerSameAsApplicant ? applicantPhone : d.owner?.phone;
  const selectedInspections = (job.critical_stage_inspections || []).filter((r) => r.enabled);

  const councilBody = job.council_letter_override
    ? job.council_letter_override.split("\n\n")
    : [
        `${firm?.name} Pty Ltd has issued a ${pathwayFull} under ${isCdc ? "Part 4" : "Sections 6.3, 6.4, 6.16"} of the Environmental Planning and Assessment Act 1979 for the above premises.`,
        ...(isCdc ? ["The applicant / owner has been advised to submit the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site."] : []),
        `Should you need to discuss any issues, please do not hesitate to contact the Registered Building Surveyor ${issuedBy?.name || "—"}.`,
      ];

  const applicantBody = job.applicant_letter_override
    ? job.applicant_letter_override.split("\n\n")
    : [
        `One copy of each has been forwarded directly to ${d.council?.lga || "Council"} for their records.`,
        `The Applicant / Owner is required to lodge the Appointment of a Principal Certifier to us through the NSW Planning Portal.`,
        ...(isCdc ? [`Please note that no works can commence on site less than 7 days from the date of issuance of ${job.pathway}.`] : []),
        `Once our office accepts the Principal Certifier Appointment through the NSW Planning Portal the Applicant / Owner is required to lodge the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site.`,
        `The Principal Certifier role to be undertaken by ${issuedBy?.name || "—"} will require inspections and certification.`,
        `Please have the Owner/Builder or licensed contractor liaise with ${issuedBy?.name || "—"} prior to commencement of the work.`,
        `Should you need to discuss any issues, please do not hesitate to contact the undersigned on the above numbers.`,
      ];

  const requiredDocsList = isCdc
    ? ["Receipt of the Council Contribution Fee.", "Receipt of the Council Bond.", "Builder’s Home Building Compensation Fund (HBCF Certificate) or Owner Builder Permit.", "Erosion and Sediment Controls to be implemented on site.", "Lodge the Principal Certifier Appointment to us through the NSW Planning Portal."]
    : ["Erosion and Sediment Controls to be installed on site.", "Builder’s Home Warranty Certificate (HBCF) or Owner Builder Permit.", "Lodge the Principal Certifier Appointment to us through the NSW Planning Portal."];

  return (
    <CertificatePackage
      backHref={`/jobs/${jobId}?tab=pathway`}
      filename={`${projRef}-Certificate-Package.doc`}
      signed={!!job.pathway_signed_at}
      signedLabel={`Signed ${formatISODate(job.pathway_signed_at)}`}
      signAction={signPathwayCertificate}
      signFields={{ job_id: jobId }}
      uploadAction={activeVersion ? uploadPathwayApproval : undefined}
      uploadFields={activeVersion ? { job_id: jobId, version_id: activeVersion.id } : undefined}
      uploadPathPrefix={`${profile.firm_id}/${jobId}/certificates/pathway/${activeVersion?.id || "current"}`}
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
              <CertRow label="BCA/NCC Version:" value={d.bcaVersion} />
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
          <div className="text-xs text-slate-400 mb-3">
            {pathwayFull} {ref} — continued
          </div>
          <table className="w-full">
            <tbody>
              <TableSectionHeading>REGISTERED CERTIFIER</TableSectionHeading>
              <CertRow label="Registered Certifier:" value={issuedBy?.name} />
              <CertRow label="Registration No:" value={issuedBy?.registration_no} />
              <CertRow label="Registration Body:" value={issuedBy?.registration_body} />
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

            <div className="font-bold mt-6 mb-1">SCHEDULE 1: MANDATORY CRITICAL STAGE INSPECTIONS</div>
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
                  <th className="border border-slate-300 px-3 py-1.5 text-left">Document</th>
                  <th className="border border-slate-300 px-3 py-1.5 w-32 text-left">Status</th>
                  <th className="border border-slate-300 px-3 py-1.5 w-28 text-left">Document date</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((i) => (
                  <tr key={i.id}>
                    <td className="border border-slate-300 px-3 py-1.5">{i.title}</td>
                    <td className="border border-slate-300 px-3 py-1.5 capitalize">{i.status}</td>
                    <td className="border border-slate-300 px-3 py-1.5">{formatISODate(i.document_date)}</td>
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
