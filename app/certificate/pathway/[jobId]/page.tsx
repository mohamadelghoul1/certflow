import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatISODate, pathwayCertRef, calcCdcLapseDate } from "@/lib/business";
import { PrintButton } from "@/components/certifier/PrintButton";

export default async function PathwayCertificatePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job || !job.pathway_generated) notFound();

  const [{ data: firm }, { data: checklists }, { data: conditions }, { data: issuedBy }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
    supabase.from("checklists").select("id, kind, checklist_items(*)").eq("job_id", jobId),
    supabase.from("conditions_of_consent").select("*").eq("job_id", jobId).order("created_at"),
    job.pathway_issued_by ? supabase.from("certifiers").select("*").eq("id", job.pathway_issued_by).single().then((r) => r.data) : Promise.resolve(null),
  ]);

  const pathwayChecklist = (checklists || []).find((c) => c.kind === "pathway");
  const nocChecklist = (checklists || []).find((c) => c.kind === "noc");
  const approvedItems = ((pathwayChecklist?.checklist_items as never[]) || []).filter((i: { status: string }) => i.status === "approved") as {
    id: string;
    title: string;
    revision: string | null;
    document_date: string | null;
    prepared_by: string | null;
    requires_stamping: boolean;
  }[];

  const { data: inspections } = await supabase.from("inspections").select("outcome").eq("job_id", jobId);
  const lapseDate = calcCdcLapseDate(
    job.pathway,
    job.details?.certificateDetails?.determinationDate,
    (nocChecklist?.checklist_items as never[]) || [],
    (inspections || []).map((i) => i.outcome)
  );

  const ref = pathwayCertRef(job.pathway, job.details?.projectNumber || job.id.slice(0, 8), job.pathway_version);
  const certName = job.pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate";
  const d = job.details || {};

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="max-w-3xl mx-auto py-8 px-4 print:hidden flex items-center justify-between">
        <Link href={`/jobs/${jobId}?tab=pathway`} className="text-sm text-slate-500 hover:text-teal-800">
          ← Back to job
        </Link>
        <PrintButton />
      </div>

      <div className="relative max-w-3xl mx-auto bg-white shadow-lg print:shadow-none p-10 mb-10">
        <div
          className="absolute top-24 right-10 text-emerald-700/30 border-4 border-emerald-700/30 rounded-md px-6 py-2 text-4xl font-black tracking-widest rotate-[-12deg] pointer-events-none select-none"
          aria-hidden
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

        <h1 className="text-center text-2xl font-bold text-slate-900 uppercase tracking-wide mb-1">{certName}</h1>
        <p className="text-center text-xs text-slate-500 mb-8">Issued under the Environmental Planning and Assessment Act 1979</p>

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Property address</div>
            <div className="text-slate-800">{job.address}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Lot/Section/DP</div>
            <div className="text-slate-800">{d.certificateDetails?.lotSectionDp || "—"}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Development description</div>
            <div className="text-slate-800">{job.description}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Building classification(s)</div>
            <div className="text-slate-800">{(d.proposal?.classifications || []).join(", ") || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Relevant instrument</div>
            <div className="text-slate-800">{d.certificateDetails?.relevantInstrument || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Date of determination</div>
            <div className="text-slate-800">{formatISODate(d.certificateDetails?.determinationDate)}</div>
          </div>
          {job.pathway === "CDC" && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Lapse date</div>
              <div className="text-slate-800">{lapseDate || "—"}</div>
            </div>
          )}
        </div>

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
              </tr>
            </thead>
            <tbody>
              {approvedItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-2 py-1.5 border-b border-slate-100">{item.title}</td>
                  <td className="px-2 py-1.5 border-b border-slate-100">{item.revision || "—"}</td>
                  <td className="px-2 py-1.5 border-b border-slate-100">{formatISODate(item.document_date)}</td>
                  <td className="px-2 py-1.5 border-b border-slate-100">{item.prepared_by || "—"}</td>
                  <td className="px-2 py-1.5 border-b border-slate-100">{item.requires_stamping ? "Yes" : "No"}</td>
                </tr>
              ))}
              {approvedItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-center text-slate-400">
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
          <div className="text-slate-500 mt-1">Issued {formatISODate(job.pathway_generated_date)} (v{job.pathway_version})</div>
        </div>
      </div>
    </div>
  );
}
