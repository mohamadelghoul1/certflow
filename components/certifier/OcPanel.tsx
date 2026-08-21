import Link from "next/link";
import { formatISODate, stageComplete } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { reportOcToPortal, markJobComplete, reopenJob, notifyClientMessage, sendOcToClient } from "@/lib/actions/jobs";
import { ChecklistSection } from "@/components/certifier/ChecklistSection";
import { IssueOcForm } from "@/components/certifier/IssueOcForm";
import { SendToClientButton } from "@/components/certifier/SendToClientButton";
import { Download } from "lucide-react";
import type { Job, Certifier, OcRecord, ChecklistItem, Amendment } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[] };
type LibItem = { title: string; description: string | null; category: string | null };

export async function OcPanel({
  job,
  firmId,
  checklistId,
  items,
  certifiers,
  ocRecords,
  library,
}: {
  job: Job;
  firmId: string;
  checklistId: string;
  items: ItemWithAmendments[];
  certifiers: Certifier[];
  ocRecords: OcRecord[];
  library: LibItem[];
}) {
  const complete = stageComplete(items);
  const hasWhole = ocRecords.some((r) => r.type === "whole");

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-heading mb-2">OC checklist</div>
        <ChecklistSection jobId={job.id} firmId={firmId} checklistId={checklistId} label="Occupation Certificate" library={library} items={items} />
      </div>

      {!job.pathway_generated && <div className="text-xs text-muted">Occupation Certificates can&apos;t be issued until the {job.pathway} is issued.</div>}

      {job.pathway_generated && complete && <IssueOcForm jobId={job.id} assignedCertifierId={job.assigned_certifier_id} certifiers={certifiers} />}

      <div className="space-y-3">
        {ocRecords.map((r) => (
          <OcRecordCard key={r.id} record={r} job={job} firmId={firmId} certifiers={certifiers} />
        ))}
      </div>

      {hasWhole && job.status !== "complete" && (
        <form action={markJobComplete}>
          <input type="hidden" name="job_id" value={job.id} />
          <button className="text-sm font-medium text-white bg-secondary hover:opacity-90 px-4 py-1.5 rounded-full">Mark project complete</button>
        </form>
      )}
      {job.status === "complete" && (
        <form action={reopenJob}>
          <input type="hidden" name="job_id" value={job.id} />
          <button className="text-xs text-muted hover:underline">Reopen project</button>
        </form>
      )}
    </div>
  );
}

async function OcRecordCard({ record, job, certifiers }: { record: OcRecord; job: Job; firmId: string; certifiers: Certifier[] }) {
  const issuedBy = certifiers.find((c) => c.id === record.issued_by);
  const approvalUrl = await signedUrl(record.approval_file_path);
  return (
    <div className="card-lift border border-line rounded-xl p-6 shadow-sm bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-heading">
            {record.type === "whole" ? "Whole OC" : "Partial OC"} {record.description ? `— ${record.description}` : ""}
          </div>
          <div className="text-xs text-muted mt-0.5">
            Issued {formatISODate(record.generated_date)} by {issuedBy?.name || "—"}
            {record.signed_at ? ` · Signed ${formatISODate(record.signed_at)}` : " · Not yet signed"}
            {record.sent_to_client ? ` · Sent to client ${formatISODate(record.sent_to_client_date)}` : " · Not sent to client"}
          </div>
        </div>
        <Link href={`/certificate/oc/${job.id}/${record.id}`} target="_blank" className="text-xs font-semibold text-secondary hover:underline shrink-0">
          {record.signed_at ? "View document →" : "Generate / sign document →"}
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-4 flex-wrap">
        {/* The OC .docx route is per-record, so unlike the pathway versions
            every card can safely offer its own download. Matters most once
            signed, when the document page hides its own Export as Word. */}
        <a href={`/api/certificate/oc/${job.id}/${record.id}/word`} className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
          <Download size={12} /> Download Word
        </a>
        {approvalUrl && (
          <a href={approvalUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">
            View uploaded copy
          </a>
        )}
        {!record.sent_to_client && (
          <SendToClientButton
            action={sendOcToClient}
            fields={{ job_id: job.id, oc_id: record.id }}
            disabled={!record.signed_at && !record.approval_uploaded}
            disabledReason="Sign the certificate document first"
          />
        )}
        {record.sent_to_client && (
          <form action={notifyClientMessage}>
            <input type="hidden" name="job_id" value={job.id} />
            <input type="hidden" name="subject" value="Occupation Certificate issued" />
            <input type="hidden" name="message" value={`Your ${record.type === "whole" ? "Whole" : "Partial"} Occupation Certificate has been issued and is now available to view in your portal.`} />
            <button className="text-xs font-semibold text-secondary hover:underline">Notify client again</button>
          </form>
        )}
        <form action={reportOcToPortal}>
          <input type="hidden" name="job_id" value={job.id} />
          <input type="hidden" name="oc_id" value={record.id} />
          <button disabled={record.portal_reported} className="text-xs font-semibold text-slate-600 hover:underline disabled:opacity-50 disabled:cursor-default">
            {record.portal_reported ? `Reported to Portal ${formatISODate(record.portal_reported_date)}` : "Report to NSW Planning Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}
