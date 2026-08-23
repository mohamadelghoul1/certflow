import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatISODate } from "@/lib/business";
import { signOc, uploadOcApproval } from "@/lib/actions/jobs";
import { CertificatePackage } from "@/components/certifier/CertificatePackage";
import { DocumentHeader } from "@/components/certifier/DocumentHeader";
import { getOcCertificateData } from "@/lib/certificates/ocData";
import { formatAddress } from "@/lib/certificates/pathwayData";

function CertRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr className="align-top">
      <td className="py-1.5 pr-4 text-sm font-semibold text-heading whitespace-nowrap w-1/3">{label}</td>
      <td className="py-1.5 text-sm text-muted">{value || "—"}</td>
    </tr>
  );
}

function Section({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={`bg-white p-8 mb-6 shadow-sm print:shadow-none print:mb-0 print:p-[14mm] ${!last ? "print:break-after-page" : ""}`}
      data-page-break={!last ? "after" : undefined}
    >
      {children}
    </div>
  );
}

function DocFooter({ projRef, website }: { projRef: string; website?: string | null }) {
  return (
    <table className="w-full text-[11px] text-placeholder border-t border-line mt-6 pt-2">
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
  const { job, firm, record, issuedBy, approvedItems, signatureUrl, uploadedApprovalUrl, logoUrl, ref, projRef, typeLabel, consentRef, d, issuedDate, applicantName } = data;

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
      <div className="cert-doc max-w-3xl mx-auto px-4 pb-10 print:px-0 print:max-w-none">
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
                <strong>{typeLabel} No.</strong>&nbsp;&nbsp;{ref}
              </div>
            </div>
            <div>
              {firm?.name} Pty Ltd has issued a {typeLabel.toLowerCase()} under Part 6 Division 3 of the Environmental Planning and Assessment Act 1979 for
              the above premises, relying on {job.pathway} No. {consentRef}. Please find enclosed a copy for your records.
            </div>
            <div className="pt-4">Yours sincerely,</div>
            <SignatureLine signatureUrl={signatureUrl} topPadding="pt-6" />
            <div>{issuedBy?.name || "—"}</div>
            <div className="text-xs text-placeholder">Registered Certifier / {issuedBy?.registration_no}</div>
            <div className="text-xs text-placeholder">{firm?.name} Pty Ltd</div>
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
                <strong>{typeLabel} No.:</strong>&nbsp;&nbsp;{ref}
              </div>
            </div>
            <div>
              Enclosed is a copy of the issued {typeLabel} for the subject development. One copy has been forwarded directly to {d.council?.lga || "Council"}{" "}
              for their records.
            </div>
            <div>Please retain this certificate, as it authorises {record.type === "whole" ? "occupation and use of the building" : "occupation and use of the part of the building described below"}.</div>
            <div className="pt-4">Yours sincerely,</div>
            <SignatureLine signatureUrl={signatureUrl} topPadding="pt-6" />
            <div>{issuedBy?.name || "—"}</div>
            <div className="text-xs text-placeholder">Registered Certifier / {issuedBy?.registration_no}</div>
            <div className="text-xs text-placeholder">{firm?.name} Pty Ltd</div>
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
            <table className="w-full border-b-2 border-heading mb-6">
              <tbody>
                <tr>
                  <td className="align-top pb-4">
                    <div className="text-xl font-bold text-heading">{firm?.name}</div>
                    <div className="text-xs text-placeholder mt-1">ABN {firm?.abn}</div>
                    <div className="text-xs text-placeholder">{firm?.office_address}</div>
                    <div className="text-xs text-placeholder">
                      {firm?.phone} · {firm?.email}
                    </div>
                  </td>
                  <td className="align-top pb-4 text-right text-xs text-placeholder">
                    <div>Reference</div>
                    <div className="font-mono font-semibold text-heading">{ref}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            <h1 className="text-center text-2xl font-bold text-heading uppercase tracking-wide mb-1">{typeLabel}</h1>
            <p className="text-center text-xs text-placeholder mb-8">Issued under Part 6 Division 3 of the Environmental Planning and Assessment Act 1979</p>

            <table className="w-full mb-8">
              <tbody>
                <CertRow label="Property address" value={job.address} />
                <CertRow label="Lot/Section/DP" value={d.certificateDetails?.lotSectionDp} />
                <CertRow label="Development description" value={record.description || job.description} />
                <CertRow label="Building classification(s)" value={(d.proposal?.classifications || []).join(", ")} />
                <CertRow label={`${job.pathway} relied upon`} value={consentRef} />
                <CertRow label="Date of issue" value={issuedDate} />
              </tbody>
            </table>

            <div className="mb-8">
              <div className="text-xs font-bold uppercase tracking-wide text-placeholder mb-2">Documents relied upon</div>
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
                      <td className="px-2 py-1.5 border-b border-line">{formatISODate(item.document_date)}</td>
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

            <div className="border-t border-line pt-4 mt-8 text-sm">
              <div className="text-[11px] uppercase tracking-wide text-placeholder mb-1">Certifying authority</div>
              <div className="font-semibold text-heading">{issuedBy?.name || "—"}</div>
              <div className="text-placeholder">
                {issuedBy?.registration_no} · {issuedBy?.registration_body}
              </div>
              <div className="text-placeholder mt-1">Issued {issuedDate}</div>
            </div>
          </div>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>
      </div>
    </CertificatePackage>
  );
}
