"use client";

import { useActionState, useState, useTransition } from "react";
import { FileUpload } from "@/components/certifier/FileUpload";
import { createAgreement, sendAgreement, removeAgreement, type AgreementState } from "@/lib/actions/agreements";
import { agreementProgress, progressLabel, type Signatory } from "@/lib/agreements";
import { formatISODate } from "@/lib/business";
import { FileText, Send, CheckCircle2, Clock, Trash2, Plus, FileCheck2 } from "lucide-react";
import { SignaturePositioner } from "@/components/certifier/SignaturePositioner";

type Agreement = {
  id: string;
  file_name: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  signatories: Signatory[];
  placement: { page: number; x: number; y: number; width: number } | null;
};

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-xs font-semibold text-placeholder mb-1";

// The engagement agreement, from upload to fully signed.
//
// The document is whatever the firm already uses — CertFlow doesn't
// write the contract, it sends it out and captures the signatures. Each
// signatory gets their own private link and needs no login: an owner is
// usually not the person using the client portal.
export function AgreementPanel({
  jobId,
  firmId,
  agreement,
  documentUrl,
  signedUrl,
}: {
  jobId: string;
  firmId: string;
  agreement: Agreement | null;
  documentUrl: string | null;
  signedUrl: string | null;
}) {
  // Removing flips straight back to the empty form and lets the delete
  // finish behind it — pressing Remove and watching the signed agreement
  // sit there while the whole job page re-renders read as nothing having
  // happened. If the delete fails the panel comes back with the reason.
  const [removed, setRemoved] = useState(false);
  const [removeError, setRemoveError] = useState("");

  if (agreement && !removed) {
    return (
      <ExistingAgreement
        jobId={jobId}
        agreement={agreement}
        documentUrl={documentUrl}
        signedUrl={signedUrl}
        onRemoved={() => {
          setRemoveError("");
          setRemoved(true);
        }}
        onRemoveFailed={(message) => {
          setRemoved(false);
          setRemoveError(message);
        }}
      />
    );
  }
  return <NewAgreement jobId={jobId} firmId={firmId} notice={removeError} />;
}

function NewAgreement({ jobId, firmId, notice }: { jobId: string; firmId: string; notice?: string }) {
  const [state, formAction, pending] = useActionState<AgreementState, FormData>(createAgreement, undefined);
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [parties, setParties] = useState([{ id: 1 }]);

  return (
    <div className="rounded-xl border border-line bg-white shadow-sm p-6">
      <div className="font-bold text-primary">Engagement agreement</div>
      {notice && <div className="text-sm text-error mt-2">{notice}</div>}
      <p className="text-sm text-muted mt-1 mb-5">
        Upload the agreement you use, then name everyone who has to sign it. Each is emailed their own signing link — they don&rsquo;t need a CertFlow
        login — and the agreement is complete once all of them have signed.
      </p>

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="job_id" value={jobId} />
        <input type="hidden" name="file_path" value={filePath} />
        <input type="hidden" name="file_name" value={fileName} />

        <div>
          <div className={labelCls}>The agreement document</div>
          {filePath ? (
            <div className="flex items-center gap-2 text-sm text-accent">
              <CheckCircle2 size={15} /> {fileName || "Uploaded"}
              <button type="button" onClick={() => { setFilePath(""); setFileName(""); }} className="text-xs text-muted hover:underline ml-2">
                Change
              </button>
            </div>
          ) : (
            <FileUpload
              pathPrefix={`${firmId}/${jobId}/agreements`}
              label="Upload the agreement (PDF)"
              onUploaded={(path) => {
                setFilePath(path);
                setFileName(decodeURIComponent(path.split("/").pop() || "").replace(/^\d+-/, ""));
              }}
            />
          )}
        </div>

        <div>
          <div className={labelCls}>Who has to sign</div>
          <div className="space-y-2">
            {parties.map((p, i) => (
              <div key={p.id} className="grid sm:grid-cols-[1.2fr_1.4fr_0.8fr_auto] gap-2">
                <input name="signatory_name" placeholder="Full name" className={inputCls} />
                <input name="signatory_email" type="email" placeholder="Email address" className={inputCls} />
                <input name="signatory_role" placeholder="Owner" defaultValue={i === 0 ? "Owner" : ""} className={inputCls} />
                {parties.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setParties((prev) => prev.filter((x) => x.id !== p.id))}
                    className="text-xs text-error hover:underline px-2"
                  >
                    Remove
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setParties((prev) => [...prev, { id: Date.now() }])}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Plus size={14} /> Add another signatory
          </button>
          <p className="text-[11px] text-muted mt-2">Joint owners each sign separately. Add the applicant or builder too if they are party to the agreement.</p>
        </div>

        {state?.error && <div className="text-sm text-error">{state.error}</div>}
        <button disabled={pending || !filePath} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
          {pending ? "Saving…" : "Prepare agreement"}
        </button>
      </form>
    </div>
  );
}

function ExistingAgreement({
  jobId,
  agreement,
  documentUrl,
  signedUrl,
  onRemoved,
  onRemoveFailed,
}: {
  jobId: string;
  agreement: Agreement;
  documentUrl: string | null;
  signedUrl: string | null;
  onRemoved: () => void;
  onRemoveFailed: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState<AgreementState, FormData>(sendAgreement, undefined);
  const [, startRemove] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const progress = agreementProgress(agreement.signatories);

  function remove() {
    // Gone from the screen at once; the delete finishes behind it.
    onRemoved();
    startRemove(async () => {
      try {
        const fd = new FormData();
        fd.set("agreement_id", agreement.id);
        fd.set("job_id", jobId);
        await removeAgreement(fd);
      } catch {
        onRemoveFailed("That agreement could not be removed. It is still there — please try again.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-white shadow-sm p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-bold text-primary">Engagement agreement</div>
          <div className={`text-sm font-semibold mt-0.5 ${progress.complete ? "text-accent" : "text-muted"}`}>{progressLabel(progress)}</div>
        </div>
        {progress.complete && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-bg text-accent text-xs font-semibold shrink-0">
            <CheckCircle2 size={13} /> Complete
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent/10 border border-accent/40 text-accent text-sm font-semibold hover:bg-accent/15"
          >
            <FileCheck2 size={15} /> Signed agreement
          </a>
        )}
        {documentUrl && (
          <a href={documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline">
            <FileText size={15} /> {signedUrl ? "The original, unsigned" : agreement.file_name || "Open the agreement"}
          </a>
        )}
      </div>

      {/* Where the signatures land on the firm's own execution block.
          Worth setting before sending, but it can be moved right up
          until the last signature arrives. */}
      {!agreement.completed_at && documentUrl && (
        <div className="rounded-md bg-surface border border-line px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="text-xs text-muted flex-1 min-w-[220px]">
            {agreement.placement
              ? `Signatures will be drawn onto page ${agreement.placement.page} of your contract.`
              : "Signatures will be added on a page at the end unless you place them on your contract's own signature box."}
          </div>
          <SignaturePositioner
            agreementId={agreement.id}
            jobId={jobId}
            fileUrl={documentUrl}
            signatories={agreement.signatories.length}
            initial={agreement.placement}
          />
        </div>
      )}

      <div className="rounded-lg border border-line overflow-hidden">
        {agreement.signatories.map((s) => (
          <div key={s.id} className="px-4 py-3 border-b border-line last:border-b-0 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-heading">
                {s.name}
                {s.role ? <span className="font-normal text-placeholder"> · {s.role}</span> : null}
              </div>
              <div className="text-xs text-placeholder truncate">{s.email}</div>
              {s.signed_at && s.signed_name && s.signed_name !== s.name && (
                <div className="text-[11px] text-muted mt-0.5">Signed as &ldquo;{s.signed_name}&rdquo;</div>
              )}
            </div>
            {s.signed_at ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent shrink-0">
                <CheckCircle2 size={13} /> Signed {formatISODate(s.signed_at.slice(0, 10))}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted shrink-0">
                <Clock size={13} /> {s.sent_at ? `Sent ${formatISODate(s.sent_at.slice(0, 10))}` : "Not sent yet"}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!progress.complete && (
          <form action={formAction}>
            <input type="hidden" name="agreement_id" value={agreement.id} />
            <input type="hidden" name="job_id" value={jobId} />
            <button disabled={pending} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
              <Send size={14} /> {pending ? "Sending…" : agreement.sent_at ? "Send a reminder" : "Send for signature"}
            </button>
          </form>
        )}
        {progress.complete && (
          <a href={`/agreements/${agreement.id}/record`} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-line text-sm font-semibold text-primary hover:bg-hover">
            <FileText size={14} /> Signing record
          </a>
        )}
        {/* A signed agreement is a record of something that happened, so
            that one asks first. An unsigned one goes on the press. */}
        <div className="ml-auto">
          {confirming ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-error">Delete this signed agreement?</span>
              <button type="button" onClick={remove} className="text-xs font-semibold text-error hover:underline">
                Yes, remove it
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="text-xs text-muted hover:underline">
                Keep it
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => (progress.signed > 0 ? setConfirming(true) : remove())}
              className="inline-flex items-center gap-1.5 text-xs text-error hover:underline"
            >
              <Trash2 size={12} /> Remove and start again
            </button>
          )}
        </div>
      </div>

      {state?.error && <div className="text-sm text-error">{state.error}</div>}
      {state?.success && <div className="text-sm text-success">{state.success}</div>}
      {!progress.complete && (
        <p className="text-[11px] text-muted">Sending again only emails the people who haven&rsquo;t signed yet, so it doubles as the chaser.</p>
      )}
    </div>
  );
}
