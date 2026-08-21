import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatISODate, pathwayCertRef, calcCdcLapseDate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { signPathwayCertificate } from "@/lib/actions/jobs";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { DocumentHeader } from "@/components/certifier/DocumentHeader";
import type { Job } from "@/types/db";

function formatAddress(a?: Record<string, string> | null) {
  if (!a) return "—";
  const parts = [a.streetNumber, a.street].filter(Boolean).join(" ");
  const rest = [a.suburb, a.state, a.postcode].filter(Boolean).join(" ");
  return [parts, rest].filter(Boolean).join(", ") || "—";
}

function CertRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr className="align-top">
      <td className="py-1.5 pr-4 text-sm font-semibold text-slate-800 whitespace-nowrap w-1/3">{label}</td>
      <td className="py-1.5 text-sm text-slate-700">{value || "—"}</td>
    </tr>
  );
}

function Section({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`bg-white p-10 mb-6 shadow-sm print:shadow-none print:mb-0 ${!last ? "print:break-after-page" : ""}`} data-page-break={!last ? "after" : undefined}>
      {children}
    </div>
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

  const [{ data: firm }, { data: checklists }, { data: conditions }, { data: issuedBy }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
    supabase.from("checklists").select("id, kind, checklist_items(*)").eq("job_id", jobId),
    supabase.from("conditions_of_consent").select("*").eq("job_id", jobId).order("created_at"),
    job.pathway_issued_by ? supabase.from("certifiers").select("*").eq("id", job.pathway_issued_by).single().then((r) => r.data) : Promise.resolve(null),
  ]);
  const signatureUrl = job.pathway_signed_at && issuedBy?.signature_url ? await signedUrl(issuedBy.signature_url) : null;
  const logoUrl = firm?.logo_url ? await signedUrl(firm.logo_url) : null;

  const pathwayChecklist = (checklists || []).find((c) => c.kind === "pathway");
  const nocChecklist = (checklists || []).find((c) => c.kind === "noc");
  const allItems = ((pathwayChecklist?.checklist_items as never[]) || []) as {
    id: string;
    title: string;
    status: string;
    revision: string | null;
    document_date: string | null;
    prepared_by: string | null;
    requires_stamping: boolean;
    file_path: string | null;
  }[];
  const approvedItems = allItems.filter((i) => i.status === "approved");
  const approvedFileUrls = await Promise.all(approvedItems.map((i) => signedUrl(i.file_path)));

  const { data: inspections } = await supabase.from("inspections").select("outcome").eq("job_id", jobId);
  const lapseDate = calcCdcLapseDate(
    job.pathway,
    job.details?.certificateDetails?.determinationDate,
    (nocChecklist?.checklist_items as never[]) || [],
    (inspections || []).map((i) => i.outcome)
  );

  const ref = pathwayCertRef(job.pathway, job.details?.projectNumber || job.id.slice(0, 8), job.pathway_version);
  const projRef = ref.split("/")[0];
  const pathwayFull = job.pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate";
  const d = job.details || {};
  const issuedDate = formatISODate(job.pathway_generated_date);
  const applicantName = [d.contact?.title, d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ") || d.contact?.nameOrCompany || "Applicant";
  const selectedInspections = (job.critical_stage_inspections || []).filter((r) => r.enabled);

  const councilBody = (
    job.council_letter_override ||
    [
      `${firm?.name} Pty Ltd has issued a ${pathwayFull} under Part 4 of the Environmental Planning and Assessment Act 1979 for the above premises.`,
      `Please find enclosed the following documentation:\n- ${pathwayFull} No. ${ref}\n- Copy of the application for the ${pathwayFull}.\n- Documentation used to determine the application for the ${pathwayFull} as detailed in Schedule 1 of the Certificate.`,
      ...(job.pathway === "CDC" ? ["The applicant / owner has been advised to submit the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site."] : []),
      `Should you need to discuss any issues, please do not hesitate to contact the Registered Building Surveyor ${issuedBy?.name || "—"}.`,
    ].join("\n\n")
  ).split("\n\n");

  const applicantBody = (
    job.applicant_letter_override ||
    [
      `Enclosed is a copy of the approved ${pathwayFull} for the subject development, and a copy of the stamped plans.`,
      `One copy of each has been forwarded directly to ${d.council?.lga || "Council"} for their records.`,
      `The Applicant / Owner is required to lodge the Appointment of a Principal Certifier to us through the NSW Planning Portal.`,
      `Please note that no works can commence on site less than 7 days from the date of issuance of ${job.pathway}.`,
      `Once our office accepts the Principal Certifier Appointment through the NSW Planning Portal the Applicant / Owner is required to lodge the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site.`,
      `The Principal Certifier role to be undertaken by ${issuedBy?.name || "—"} will require inspections and certification.`,
      `Please have the Owner/Builder or licensed contractor liaise with ${issuedBy?.name || "—"} prior to commencement of the work.`,
      `Please note that to accept the Notice of Appointment of Principal Certifier and Commencement of Building Work, you must provide:\n1. Receipt of the Council Contribution Fee.\n2. Receipt of the Council Work Permit Fee.\n3. Builder's Home Building Compensation Fund (HBCF Certificate) or Owner Builder Permit.\n4. Erosion and Sediment Controls to be implemented on site.\n5. Lodge the Principal Certifier Appointment to us through the NSW Planning Portal.`,
      `Should you need to discuss any issues, please do not hesitate to contact the undersigned on the above numbers.`,
    ].join("\n\n")
  ).split("\n\n");

  return (
    <CertificatePackage
      backHref={`/jobs/${jobId}?tab=pathway`}
      filename={`${projRef}-Certificate-Package.doc`}
      signed={!!job.pathway_signed_at}
      signedLabel={`Signed ${formatISODate(job.pathway_signed_at)}`}
      signAction={signPathwayCertificate}
      signFields={{ job_id: jobId }}
    >
      <div className="max-w-3xl mx-auto px-4 pb-10 print:px-0 print:max-w-none">
        <div className="text-xs text-slate-400 px-2 pb-2 print:hidden">
          1. Council letter · 2. Applicant letter · 3. Certificate &amp; schedule · 4. Mandatory inspections notice · 5. Checklist summary
        </div>

        {/* 1. Council letter */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          <div className="text-sm space-y-4">
            <div className="flex justify-between">
              <div>Our reference: {projRef}</div>
              <div>{issuedDate}</div>
            </div>
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
                <strong>Planning Instrument Decision Made Under:</strong>&nbsp;&nbsp;{d.certificateDetails?.relevantInstrument || "—"}
              </div>
            </div>
            {councilBody.map((para, i) => (
              <div key={i} className="whitespace-pre-line">
                {para}
              </div>
            ))}
            <div className="pt-4">Yours sincerely,</div>
            <SignatureLine signatureUrl={signatureUrl} topPadding="pt-10" />
            <div>{issuedBy?.name || "—"}</div>
            <div className="text-xs text-slate-500">Registered Certifier / {issuedBy?.registration_no}</div>
            <div className="text-xs text-slate-500">{firm?.name} Pty Ltd</div>
          </div>
        </Section>

        {/* 2. Applicant letter */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          <div className="text-sm space-y-4">
            <div className="flex justify-between">
              <div>Our reference: {projRef}</div>
              <div>{issuedDate}</div>
            </div>
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
            {applicantBody.map((para, i) => (
              <div key={i} className={`whitespace-pre-line ${para.startsWith("Please note that to accept") ? "bg-amber-50 border border-amber-200 rounded-md px-4 py-3" : ""}`}>
                {para}
              </div>
            ))}
            <div className="pt-4">Yours sincerely,</div>
            <SignatureLine signatureUrl={signatureUrl} topPadding="pt-10" />
            <div>{issuedBy?.name || "—"}</div>
            <div className="text-xs text-slate-500">Registered Certifier / {issuedBy?.registration_no}</div>
            <div className="text-xs text-slate-500">{firm?.name} Pty Ltd</div>
          </div>
        </Section>

        {/* 3. Certificate & schedule */}
        <Section>
          <div className="relative">
            <div
              className="absolute top-4 right-4 text-emerald-700/30 border-4 border-emerald-700/30 rounded-md px-6 py-2 text-4xl font-black tracking-widest rotate-[-12deg] pointer-events-none select-none"
              aria-hidden
              data-stamp
            >
              APPROVED
            </div>
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
              <div>
                <div className="text-xl font-bold text-slate-900">{firm?.name}</div>
                <div className="text-xs text-slate-500 mt-1">ABN {firm?.abn}</div>
                <div className="text-xs text-slate-500">{firm?.office_address}</div>
                <div className="text-xs text-slate-500">
                  {firm?.phone} · {firm?.email}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>Reference</div>
                <div className="font-mono font-semibold text-slate-800">{ref}</div>
              </div>
            </div>

            <h1 className="text-center text-2xl font-bold text-slate-900 uppercase tracking-wide mb-1">{pathwayFull}</h1>
            <p className="text-center text-xs text-slate-500 mb-8">Issued under the Environmental Planning and Assessment Act 1979</p>

            <table className="w-full mb-8">
              <tbody>
                <CertRow label="Property address" value={job.address} />
                <CertRow label="Lot/Section/DP" value={d.certificateDetails?.lotSectionDp} />
                <CertRow label="Development description" value={job.description} />
                <CertRow label="Building classification(s)" value={(d.proposal?.classifications || []).join(", ")} />
                <CertRow label="Relevant instrument" value={d.certificateDetails?.relevantInstrument} />
                <CertRow label="Date of determination" value={formatISODate(d.certificateDetails?.determinationDate)} />
                {job.pathway === "CDC" && <CertRow label="Lapse date" value={lapseDate} />}
              </tbody>
            </table>

            <div className="mb-8">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Document schedule</div>
              <table className="w-full text-xs border border-slate-200">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-2 py-1.5 border-b border-slate-200">Document</th>
                    <th className="px-2 py-1.5 border-b border-slate-200">Revision</th>
                    <th className="px-2 py-1.5 border-b border-slate-200">Document date</th>
                    <th className="px-2 py-1.5 border-b border-slate-200">Prepared by</th>
                    <th className="px-2 py-1.5 border-b border-slate-200">Stamped</th>
                    <th className="px-2 py-1.5 border-b border-slate-200 print:hidden">File</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedItems.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-2 py-1.5 border-b border-slate-100">{item.title}</td>
                      <td className="px-2 py-1.5 border-b border-slate-100">{item.revision || "—"}</td>
                      <td className="px-2 py-1.5 border-b border-slate-100">{formatISODate(item.document_date)}</td>
                      <td className="px-2 py-1.5 border-b border-slate-100">{item.prepared_by || "—"}</td>
                      <td className="px-2 py-1.5 border-b border-slate-100">{item.requires_stamping ? "Yes" : "No"}</td>
                      <td className="px-2 py-1.5 border-b border-slate-100 print:hidden">
                        {approvedFileUrls[idx] ? (
                          <a href={approvedFileUrls[idx]!} target="_blank" rel="noreferrer" className="text-teal-800 hover:underline">
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {approvedItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-3 text-center text-slate-400">
                        No approved documents.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {(conditions || []).length > 0 && (
              <div className="mb-8">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Conditions of consent</div>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700">
                  {(conditions || []).map((c) => (
                    <li key={c.id}>{c.text}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="border-t border-slate-200 pt-4 mt-8 text-sm">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Certifying authority</div>
              <div className="font-semibold text-slate-800">{issuedBy?.name || "—"}</div>
              <div className="text-slate-500">
                {issuedBy?.registration_no} · {issuedBy?.registration_body}
              </div>
              <div className="text-slate-500 mt-1">
                Issued {issuedDate} (v{job.pathway_version})
              </div>
            </div>
          </div>
        </Section>

        {/* 4. Mandatory inspections notice */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          <div className="text-sm space-y-3">
            <div className="text-base font-bold">NOTICE TO APPLICANT OF MANDATORY CRITICAL STAGE INSPECTIONS</div>
            <div className="text-xs text-slate-500">
              Made under Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 — Section 58
            </div>

            <div className="font-bold border-b border-slate-300 pb-1 mt-4">APPLICANT DETAILS</div>
            <table className="w-full">
              <tbody>
                <CertRow label="Name of the person having benefit of the Development Consent:" value={applicantName} />
                <CertRow label="Address:" value={formatAddress(d.applicantAddress)} />
                <CertRow label="Phone:" value={d.contact?.phone || d.contact?.mobile} />
              </tbody>
            </table>

            <div className="font-bold border-b border-slate-300 pb-1 mt-4">COMPLYING DEVELOPMENT CONSENTS</div>
            <table className="w-full">
              <tbody>
                <CertRow label="Consent Authority / Local Government Area:" value={d.council?.lga} />
                <CertRow label="Decision Made Under:" value={d.certificateDetails?.relevantInstrument} />
                <CertRow label={`${job.pathway} Number:`} value={ref} />
              </tbody>
            </table>

            <div className="font-bold border-b border-slate-300 pb-1 mt-4">PROPOSAL</div>
            <table className="w-full">
              <tbody>
                <CertRow label="Address of Development:" value={job.address} />
                <CertRow label="Scope of Building Works Covered by this Notice:" value={job.description} />
              </tbody>
            </table>

            <div className="font-bold border-b border-slate-300 pb-1 mt-4">CERTIFICATION DETAILS</div>
            <table className="w-full">
              <tbody>
                <CertRow label="Certifying Authority:" value={issuedBy?.name} />
                <CertRow label="Registration Number:" value={issuedBy?.registration_no} />
              </tbody>
            </table>

            <div className="pt-2">
              I, {issuedBy?.name || "—"}, of {firm?.name} Pty Ltd located at {firm?.office_address}, acting as the principal certifier, hereby give notice in
              accordance with Section 58 of Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to
              the person having the benefit of the development consent that the mandatory critical stage inspections identified in Schedule 1 are to be
              carried out in respect of the building work.
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

            <div className="flex justify-between pt-4">
              <span />
              <span>Dated: {issuedDate}</span>
            </div>
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
