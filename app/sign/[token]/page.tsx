import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrl } from "@/lib/storage";
import { formatISODate } from "@/lib/business";
import { agreementProgress, type Signatory } from "@/lib/agreements";
import { SignAgreementForm } from "@/components/SignAgreementForm";
import { FileText, CheckCircle2 } from "lucide-react";

// Where an emailed signing link lands.
//
// Deliberately outside every other part of the app: no login, no portal
// chrome, nothing but the agreement and the act of signing it. An owner
// is often not the person using the client portal — sometimes not a
// CertFlow user at all — and requiring an account to sign would put the
// paperwork straight back on paper.
//
// The token in the link is the whole authorisation, so everything is
// read through the admin client and scoped by that token alone. Nothing
// on this page is reachable without it, and it names only what the
// signatory is entitled to see: their own agreement.
export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: party } = await admin
    .from("engagement_signatories")
    .select("id, name, email, role, signed_at, signed_name, agreement_id, engagement_agreements(id, file_path, file_name, job_id, firm_id, jobs(address), firms(name, abn))")
    .eq("token", token)
    .single();

  if (!party) {
    return (
      <Shell>
        <div className="text-center">
          <div className="font-serif text-2xl font-medium text-primary">CertFlow</div>
          <h1 className="text-lg font-bold text-heading mt-6">This signing link is not valid</h1>
          <p className="text-sm text-muted mt-2">It may have been mistyped, or replaced by a newer one. Please contact your certifier for a fresh link.</p>
        </div>
      </Shell>
    );
  }

  const agreement = party.engagement_agreements as unknown as {
    id: string;
    file_path: string;
    file_name: string | null;
    jobs: { address: string } | null;
    firms: { name: string; abn: string | null } | null;
  };
  const address = agreement?.jobs?.address || "";
  const firm = agreement?.firms;
  const documentUrl = await signedUrl(agreement?.file_path, 3600, admin);

  const { data: parties } = await admin.from("engagement_signatories").select("id, name, email, role, signed_at, signed_name").eq("agreement_id", party.agreement_id);
  const progress = agreementProgress((parties || []) as Signatory[]);

  return (
    <Shell>
      <div className="text-center mb-6">
        <div className="text-lg font-black tracking-tight text-heading">{firm?.name}</div>
        {firm?.abn && <div className="text-xs text-placeholder">ABN {firm.abn}</div>}
        <div className="mt-3 text-sm font-semibold text-secondary uppercase tracking-wide">Engagement agreement</div>
        {address && <div className="text-base font-bold text-primary mt-1">{address}</div>}
      </div>

      <div className="bg-white rounded-lg border border-line shadow-sm p-6 space-y-5">
        <div>
          <div className="text-xs font-semibold text-placeholder uppercase tracking-wide mb-2">The agreement</div>
          {documentUrl ? (
            <a
              href={documentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-primary/50 text-primary font-semibold text-sm hover:bg-surface"
            >
              <FileText size={16} /> Read the agreement{agreement?.file_name ? ` (${agreement.file_name})` : ""}
            </a>
          ) : (
            <div className="text-sm text-error">The agreement document could not be opened. Please contact your certifier.</div>
          )}
          <p className="text-xs text-muted mt-2">Please read it in full before signing. You can download a copy to keep.</p>
        </div>

        <div className="border-t border-line pt-5">
          <div className="text-xs font-semibold text-placeholder uppercase tracking-wide mb-1">Signing as</div>
          <div className="text-sm font-semibold text-heading">
            {party.name}
            {party.role ? ` · ${party.role}` : ""}
          </div>
          <div className="text-xs text-placeholder">{party.email}</div>
        </div>

        <div className="border-t border-line pt-5">
          {party.signed_at ? (
            <div className="flex items-start gap-3 rounded-md bg-success-bg border border-accent/40 px-4 py-3">
              <CheckCircle2 size={18} className="text-accent shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-accent">You signed this agreement on {formatISODate(party.signed_at.slice(0, 10))}</div>
                <div className="text-muted mt-0.5">Signed as {party.signed_name}. There is nothing further for you to do — you may keep a copy using the link above.</div>
              </div>
            </div>
          ) : (
            <SignAgreementForm token={token} name={party.name} />
          )}
        </div>

        {progress.total > 1 && (
          <div className="border-t border-line pt-4 text-xs text-muted">
            This agreement is signed by {progress.total} parties · {progress.signed} signed so far.
            {!progress.complete && ` Still to sign: ${progress.outstanding.map((s) => s.name).join(", ")}.`}
          </div>
        )}
      </div>

      <p className="text-[11px] text-placeholder text-center mt-6">
        This link is personal to {party.name}. Please don&rsquo;t forward it — if someone else needs to sign, ask the certifier to add them.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface px-4 py-10">
      <div className="max-w-xl mx-auto">{children}</div>
    </div>
  );
}
