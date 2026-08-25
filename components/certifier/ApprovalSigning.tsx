"use client";

import { createContext, useContext, useOptimistic, useState, useTransition } from "react";
import { CheckCircle2, Layers, PenLine } from "lucide-react";
import { formatISODate, todayISO } from "@/lib/business";
import { signPathwayCertificate, sendPathwayCertificateToClient } from "@/lib/actions/jobs";
import { SendToClientButton } from "@/components/certifier/SendToClientButton";

// Signing an approval changes four things that sit in different parts of
// the panel: the version card turns green, its subtitle gains a signed
// date, its badge flips to Approved, and the Sign button gives way to
// "Download full approved set" — with the panel's own Send to client
// button becoming available above them.
//
// The action behind it is three quick row updates, but pressing Sign then
// waits on the whole job page being re-rendered and streamed back, which
// is what made it feel slow. Sharing one optimistic value through context
// lets every one of those parts flip the instant the button is pressed,
// the way approving a checklist item already does. If the update fails,
// React drops the optimistic value, everything snaps back, and the error
// is shown beside the button.

type Ctx = {
  // The active version's signed date, or null while it is unsigned.
  signedAt: string | null;
  sign: () => void;
  pending: boolean;
  error: string | null;
};

const ApprovalSigningContext = createContext<Ctx | null>(null);

export function ApprovalSigningProvider({ jobId, signedAt, children }: { jobId: string; signedAt: string | null; children: React.ReactNode }) {
  const [optimisticSignedAt, setOptimisticSignedAt] = useOptimistic(signedAt);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sign = () =>
    startTransition(async () => {
      setError(null);
      // The server stamps the real moment of signing; today's date is what
      // the card would show for it either way, so the two agree.
      setOptimisticSignedAt(todayISO());
      const fd = new FormData();
      fd.set("job_id", jobId);
      const result = await signPathwayCertificate(undefined, fd);
      if (result?.error) setError(result.error);
    });

  return <ApprovalSigningContext.Provider value={{ signedAt: optimisticSignedAt, sign, pending, error }}>{children}</ApprovalSigningContext.Provider>;
}

// Only the active version can be signed here, so only its card follows the
// optimistic value; every earlier version keeps the date it was signed on.
// Outside the provider — the modification cards — each card is simply
// itself.
function useSignedAt(isActive: boolean, ownSignedAt: string | null) {
  const ctx = useContext(ApprovalSigningContext);
  return isActive && ctx ? ctx.signedAt : ownSignedAt;
}

// Green means approved, consistently with the checklist items — and a
// certificate is only approved once it has been signed.
export function VersionCard({ isActive, signedAt, children }: { isActive: boolean; signedAt: string | null; children: React.ReactNode }) {
  const signed = useSignedAt(isActive, signedAt);
  return <div className={`border rounded-xl p-4 ${signed ? "border-accent/40 bg-success-bg" : "border-line bg-white"}`}>{children}</div>;
}

export function VersionSignedLabel({ isActive, signedAt }: { isActive: boolean; signedAt: string | null }) {
  const signed = useSignedAt(isActive, signedAt);
  return <>{signed ? ` · Signed ${formatISODate(signed)}` : " · Not yet signed"}</>;
}

export function VersionSignedBadge({ isActive, signedAt }: { isActive: boolean; signedAt: string | null }) {
  const signed = useSignedAt(isActive, signedAt);
  if (!signed) return <span className="text-[11px] font-semibold text-muted">Not yet signed</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
      <CheckCircle2 size={12} /> Approved
    </span>
  );
}

// One PDF holding the signed approval and every approved document behind
// it, stamped where the checklist says so — the set that actually gets
// handed on. Only offered once the approval is signed, since an unsigned
// bundle isn't a set anyone should be circulating.
export function VersionSignActions({ jobId, isActive, signedAt }: { jobId: string; isActive: boolean; signedAt: string | null }) {
  const ctx = useContext(ApprovalSigningContext);
  const signed = useSignedAt(isActive, signedAt);

  if (signed) {
    return (
      <a href={`/api/jobs/${jobId}/approval-bundle`} className="flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
        <Layers size={12} /> Download full approved set (PDF)
      </a>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => ctx?.sign()}
        disabled={!ctx}
        className="flex items-center gap-1 text-xs font-semibold text-white bg-primary hover:opacity-90 rounded-full px-3 py-1 disabled:opacity-60"
      >
        <PenLine size={12} /> Sign
      </button>
      {ctx?.error && <span className="text-[11px] text-error">{ctx.error}</span>}
    </div>
  );
}

// The panel's Send to client button, which stays out of reach until there
// is something signed to send. It lives here, rather than taking the
// signed state as a prop, so it opens up the moment Sign is pressed
// rather than a page render later.
export function SendToClientWhenSigned({ jobId, approvalUploaded }: { jobId: string; approvalUploaded: boolean }) {
  const ctx = useContext(ApprovalSigningContext);
  return (
    <SendToClientButton
      action={sendPathwayCertificateToClient}
      fields={{ job_id: jobId }}
      disabled={!ctx?.signedAt && !approvalUploaded}
      disabledReason="Sign the certificate document first"
    />
  );
}
