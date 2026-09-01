import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatDocumentDate, formatISODate } from "@/lib/business";
import { signOc, uploadOcApproval } from "@/lib/actions/jobs";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { DocumentHeader } from "@/components/certifier/DocumentHeader";
import { getOcCertificateData } from "@/lib/certificates/ocData";
import { formatAddress } from "@/lib/certificates/pathwayData";
import { OcCertificateRows } from "@/components/certifier/OcCertificateRows";

function Section({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={`cert-page bg-white p-8 mb-6 shadow-sm print:shadow-none print:mb-0 print:p-[14mm] ${!last ? "print:break-after-page" : ""}`}
      data-page-break={!last ? "after" : undefined}
    >
      {children}
    </div>
  );
}

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

export default async function OcCertificatePage({ params }: { params: Promise<{ jobId: string; ocId: string }> }) {
  const { jobId, ocId } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getOcCertificateData(jobId, ocId, profile.firm_id);
  if (!data) notFound();
  const { job, firm, record, issuedBy, approvedItems, signatureUrl, uploadedApprovalUrl, logoUrl, ref, projRef, typeLabel, consentRef, consentLabel, daNumber, d, issuedDate, applicantName } = data;

  return (
    <CertificatePackage
      backHref={`/jobs/${jobId}?tab=oc`}
      wordExportHref={`/api/certificate/oc/${jobId}/${ocId}/word`}
      signed={!!record.signed_at}
      signedLabel={`Signed ${formatISODate(record.signed_at)}`}
      signAction={signOc}
      signFields={{ job_id: jobId, oc_id: ocId }}
      uploadAction={uploadOcApproval}
      uploadFields={{ job_id: jobId, oc_id: ocId }}
      uploadPathPrefix={`${profile.firm_id}/${jobId}/certificates/oc/${ocId}`}
      uploadedUrl={uploadedApprovalUrl}
    >
      <div className="cert-doc max-w-3xl mx-auto px-4 pb-10 print:px-0 print:pb-0 print:max-w-none">
        <div className="text-xs text-placeholder px-2 pb-2 print:hidden">1. Council letter · 2. Applicant/owner letter · 3. Occupation Certificate &amp; schedule</div>
        {!issuedBy && (
          <div className="text-xs text-error bg-error-bg border border-error/40 rounded-md px-3 py-2 mx-2 mb-3 print:hidden">
            No certifier is recorded as having issued this OC — the certifier&apos;s name, registration details, and signature will show as blank on every
            page below. Re-issue and select a certifier.
          </div>
        )}
        {issuedBy && record.signed_at && !issuedBy.signature_url && (
          <div className="text-xs text-warning-text bg-warning-bg border border-warning/50 rounded-md px-3 py-2 mx-2 mb-3 print:hidden">
            Signed, but {issuedBy.name} has no signature image on file — the signature line will stay blank. Upload one in Settings → Certifiers.
          </div>
        )}

        {/* 1. Council letter */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          <div className="text-sm space-y-3">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td>Our reference: {projRef}</td>
                  <td className="text-right">{issuedDate}</td>
                </tr>
              </tbody>
            </table>
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
                <strong>Occupation Certificate No.</strong>&nbsp;&nbsp;{ref}
              </div>
              {data.letterFacts.map((fact) => (
                <div key={fact.label} className="mt-1">
                  <strong>{fact.label}</strong>&nbsp;&nbsp;{fact.value}
                </div>
              ))}
            </div>
            {/* From ocData, which the PDF and the Word export read too —
                so the letter cannot say one thing here and another in
                the file that is handed over. */}
            {data.councilBody.map((paragraph, i) => (
              <div key={i}>{paragraph}</div>
            ))}
            <div className="pt-4">Yours sincerely,</div>
            <SignatureLine signatureUrl={signatureUrl} topPadding="pt-6" />
            <div>{issuedBy?.name || "—"}</div>
            <div className="text-xs text-placeholder">{data.signoffRole} / {issuedBy?.registration_no}</div>
            <div className="text-xs text-placeholder">{firm?.name}</div>
          </div>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>

        {/* 2. Applicant/owner letter */}
        <Section>
          <DocumentHeader firm={firm} logoUrl={logoUrl} />
          <div className="text-sm space-y-3">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td>Our reference: {projRef}</td>
                  <td className="text-right">{issuedDate}</td>
                </tr>
              </tbody>
            </table>
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
                <strong>Occupation Certificate No.:</strong>&nbsp;&nbsp;{ref}
              </div>
              {data.letterFacts.map((fact) => (
                <div key={fact.label} className="mt-1">
                  <strong>{fact.label}</strong>&nbsp;&nbsp;{fact.value}
                </div>
              ))}
            </div>
            {data.applicantBody.map((paragraph, i) => (
              <div key={i}>{paragraph}</div>
            ))}
            <div className="pt-4">Yours sincerely,</div>
            <SignatureLine signatureUrl={signatureUrl} topPadding="pt-6" />
            <div>{issuedBy?.name || "—"}</div>
            <div className="text-xs text-placeholder">{data.signoffRole} / {issuedBy?.registration_no}</div>
            <div className="text-xs text-placeholder">{firm?.name}</div>
          </div>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>

        {/* 3. Occupation Certificate & schedule */}
        <Section last>
          <div className="relative">
            <div
              className="absolute top-4 right-4 text-success/30 border-4 border-success/30 rounded-md px-6 py-2 text-4xl font-black tracking-widest rotate-[-12deg] pointer-events-none select-none"
              aria-hidden
            >
              APPROVED
            </div>
            <DocumentHeader firm={firm} logoUrl={logoUrl} />

            <h1 className="text-center text-lg font-bold text-heading uppercase tracking-wide mb-1">{data.certTitle}</h1>
            <p className="text-center text-xs text-placeholder mb-8">{data.certSubtitle}</p>

            <OcCertificateRows data={data} />

            {/* Only a partial carries a condition: the whole building's OC
                is owed within five years. A whole OC prints none. */}
            {data.partialConditions && (
              <div className="mb-8">
                <div className="text-sm font-bold uppercase text-doc-heading border-b border-line pb-1 mb-2">{data.partialConditions.heading}</div>
                <div className="text-sm font-semibold text-heading">{data.partialConditions.clause}</div>
                <div className="text-sm text-muted mt-1">{data.partialConditions.text}</div>
              </div>
            )}

            <div className="mb-8">
              <div className="text-sm font-bold uppercase text-doc-heading border-b border-line pb-1 mb-2">{data.determination.heading}</div>
              <div className="text-sm">
                <span className="font-semibold text-heading">{data.determination.dateLabel}</span> <span className="text-muted">{data.determination.date}</span>
              </div>
              <div className="text-sm mt-3">{data.determination.opening}</div>
              <ul className="text-sm text-muted mt-2 space-y-1 list-disc pl-6">
                {data.determination.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <SignatureLine signatureUrl={signatureUrl} topPadding="pt-4" />
              <div className="text-sm font-semibold text-heading">{issuedBy?.name || "—"}</div>
              <div className="text-xs text-placeholder">
                {issuedBy?.registration_no} · {issuedBy?.registration_body}
              </div>
            </div>

            <div className="mb-8">
              <div className="text-sm font-bold uppercase text-doc-heading border-b border-line pb-1 mb-2">{data.scheduleHeading}</div>
              <table className="w-full text-xs border border-line">
                <thead>
                  <tr className="bg-surface text-left">
                    <th className="px-2 py-1.5 border-b border-line">Prepared by</th>
                    <th className="px-2 py-1.5 border-b border-line">Document</th>
                    <th className="px-2 py-1.5 border-b border-line">Reference no.</th>
                    <th className="px-2 py-1.5 border-b border-line">Revision</th>
                    <th className="px-2 py-1.5 border-b border-line">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-1.5 border-b border-line">{item.prepared_by || "—"}</td>
                      <td className="px-2 py-1.5 border-b border-line">{item.title}</td>
                      <td className="px-2 py-1.5 border-b border-line">{item.drawing_number || "—"}</td>
                      <td className="px-2 py-1.5 border-b border-line">{item.revision || "—"}</td>
                      <td className="px-2 py-1.5 border-b border-line">{formatDocumentDate(item.document_date)}</td>
                    </tr>
                  ))}
                  {approvedItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-3 text-center text-placeholder">
                        No approved documents.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>
      </div>
    </CertificatePackage>
  );
}
