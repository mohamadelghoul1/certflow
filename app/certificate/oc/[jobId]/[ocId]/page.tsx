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
      <td className="py-1.5 pr-4 text-sm font-semibold text-slate-800 whitespace-nowrap w-1/3">{label}</td>
      <td className="py-1.5 text-sm text-slate-700">{value || "—"}</td>
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
      <div className="max-w-3xl mx-auto px-4 pb-10 print:px-0 print:max-w-none">
        <div className="text-xs text-slate-400 px-2 pb-2 print:hidden">1. Council letter · 2. Applicant/owner letter · 3. Occupation Certificate &amp; schedule</div>
        {!issuedBy && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mx-2 mb-3 print:hidden">
            No certifier is recorded as having issued this OC — the certifier&apos;s name, registration details, and signature will show as blank on every
            page below. Re-issue and select a certifier.
          </div>
        )}
        {issuedBy && record.signed_at && !issuedBy.signature_url && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mx-2 mb-3 print:hidden">
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
            <div className="text-xs text-slate-500">Registered Certifier / {issuedBy?.registration_no}</div>
            <div className="text-xs text-slate-500">{firm?.name} Pty Ltd</div>
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
            <div className="text-xs text-slate-500">Registered Certifier / {issuedBy?.registration_no}</div>
            <div className="text-xs text-slate-500">{firm?.name} Pty Ltd</div>
          </div>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>

        {/* 3. Occupation Certificate & schedule */}
        <Section last>
          <div className="relative">
            <div
              className="absolute top-4 right-4 text-emerald-700/30 border-4 border-emerald-700/30 rounded-md px-6 py-2 text-4xl font-black tracking-widest rotate-[-12deg] pointer-events-none select-none"
              aria-hidden
              data-stamp
            >
              APPROVED
            </div>
            <table className="w-full border-b-2 border-slate-800 mb-6">
              <tbody>
                <tr>
                  <td className="align-top pb-4">
                    <div className="text-xl font-bold text-slate-900">{firm?.name}</div>
                    <div className="text-xs text-slate-500 mt-1">ABN {firm?.abn}</div>
                    <div className="text-xs text-slate-500">{firm?.office_address}</div>
                    <div className="text-xs text-slate-500">
                      {firm?.phone} · {firm?.email}
                    </div>
                  </td>
                  <td className="align-top pb-4 text-right text-xs text-slate-500">
                    <div>Reference</div>
                    <div className="font-mono font-semibold text-slate-800">{ref}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            <h1 className="text-center text-2xl font-bold text-slate-900 uppercase tracking-wide mb-1">{typeLabel}</h1>
            <p className="text-center text-xs text-slate-500 mb-8">Issued under Part 6 Division 3 of the Environmental Planning and Assessment Act 1979</p>

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
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Documents relied upon</div>
              <table className="w-full text-xs border border-slate-200">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-2 py-1.5 border-b border-slate-200">Document</th>
                    <th className="px-2 py-1.5 border-b border-slate-200">Revision</th>
                    <th className="px-2 py-1.5 border-b border-slate-200">Document date</th>
                    <th className="px-2 py-1.5 border-b border-slate-200">Prepared by</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-1.5 border-b border-slate-100">{item.title}</td>
                      <td className="px-2 py-1.5 border-b border-slate-100">{item.revision || "—"}</td>
                      <td className="px-2 py-1.5 border-b border-slate-100">{formatISODate(item.document_date)}</td>
                      <td className="px-2 py-1.5 border-b border-slate-100">{item.prepared_by || "—"}</td>
                    </tr>
                  ))}
                  {approvedItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-3 text-center text-slate-400">
                        No approved documents.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 pt-4 mt-8 text-sm">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Certifying authority</div>
              <div className="font-semibold text-slate-800">{issuedBy?.name || "—"}</div>
              <div className="text-slate-500">
                {issuedBy?.registration_no} · {issuedBy?.registration_body}
              </div>
              <div className="text-slate-500 mt-1">Issued {issuedDate}</div>
            </div>
          </div>
          <DocFooter projRef={projRef} website={firm?.website} />
        </Section>
      </div>
    </CertificatePackage>
  );
}
