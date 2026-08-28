import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { formatISODate, todayISO } from "@/lib/business";
import type { Signatory } from "@/lib/agreements";

// The evidence that the agreement was signed: who signed, as what, when,
// and from where. Kept as its own document because the agreement itself
// is the firm's own PDF — CertFlow doesn't alter it, it records what
// happened to it. This is the page an auditor asks for.
export default async function AgreementRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: agreement } = await supabase
    .from("engagement_agreements")
    .select("id, file_name, sent_at, completed_at, created_at, job_id, jobs(address), engagement_signatories(id, name, email, role, signed_at, signed_name, signature_image, signed_ip)")
    .eq("id", id)
    .eq("firm_id", profile.firm_id)
    .single();
  if (!agreement) notFound();

  const { data: firm } = await supabase.from("firms").select("name, abn").eq("id", profile.firm_id).single();
  const parties = (agreement.engagement_signatories as (Signatory & { signed_ip: string | null })[]) || [];
  const address = (agreement.jobs as unknown as { address: string } | null)?.address || "";

  return (
    <div className="min-h-screen bg-surface print:bg-white">
      <style>{`@page { size: A4 portrait; margin: 16mm; }`}</style>
      <div className="max-w-3xl mx-auto py-6 px-4 print:hidden flex items-center justify-between gap-2">
        <Link href={`/jobs/${agreement.job_id}?tab=agreement`} className="text-sm text-placeholder hover:text-primary">
          ← Back to the project
        </Link>
        <PrintButton label="Save as PDF" />
      </div>

      <div className="max-w-3xl mx-auto p-8 bg-white text-heading shadow-sm print:shadow-none print:p-0">
        <div className="flex justify-between items-baseline border-b border-heading pb-2 mb-6">
          <div>
            <div className="text-lg font-black tracking-tight">{firm?.name}</div>
            <div className="text-sm font-semibold">Certificate of electronic signing</div>
          </div>
          <div className="text-right text-xs text-muted">
            {firm?.abn && <div>ABN {firm.abn}</div>}
            <div>Prepared {formatISODate(todayISO())}</div>
          </div>
        </div>

        <div className="mb-6 text-sm">
          <div className="font-bold text-base">{address}</div>
          <div className="text-muted mt-1">
            Agreement document: {agreement.file_name || "engagement agreement"}
            <br />
            Prepared {formatISODate(agreement.created_at.slice(0, 10))}
            {agreement.sent_at ? ` · sent for signature ${formatISODate(agreement.sent_at.slice(0, 10))}` : ""}
            {agreement.completed_at ? ` · fully signed ${formatISODate(agreement.completed_at.slice(0, 10))}` : ""}
          </div>
        </div>

        <div className="space-y-4">
          {parties.map((p) => (
            <div key={p.id} className="border border-line rounded-md p-4 break-inside-avoid">
              <div className="flex justify-between items-baseline gap-4">
                <div className="font-semibold text-sm">
                  {p.name}
                  {p.role ? <span className="font-normal text-muted"> · {p.role}</span> : null}
                </div>
                <div className="text-xs text-muted">{p.email}</div>
              </div>
              {p.signed_at ? (
                <div className="mt-2 text-xs text-muted space-y-0.5">
                  <div>
                    Signed as <span className="font-semibold text-heading">{p.signed_name}</span> on{" "}
                    {new Date(p.signed_at).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "long", timeStyle: "short" })} (Sydney)
                  </div>
                  {p.signed_ip && <div>Recorded from {p.signed_ip}</div>}
                  <div>Declared they had read the agreement, were authorised to sign, and agreed to be bound by its terms.</div>
                  {p.signature_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.signature_image} alt={`${p.name} signature`} className="h-16 mt-2 border-b border-line" />
                  )}
                </div>
              ) : (
                <div className="mt-2 text-xs text-warning-text">Not yet signed.</div>
              )}
            </div>
          ))}
        </div>

        <div className="text-[10px] text-muted border-t border-line pt-3 mt-8">
          Electronic signatures recorded by CertFlow. Each signatory received a private link by email, confirmed their identity by signing in their own
          name, and accepted the declaration shown above. This record accompanies, and does not replace, the agreement document itself.
        </div>
      </div>
    </div>
  );
}
