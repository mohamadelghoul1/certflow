import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { pathwayLabel, displayStatus, checklistProgress, formatISODate, todayISO } from "@/lib/business";
import type { ChecklistItem, Amendment, ChecklistItemFile } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[]; checklist_item_files?: ChecklistItemFile[] | null };

// The client's checklist as a document they can keep or forward — the
// thing a builder asks for when they want to know what is still owed.
// Lives outside the portal's chrome so Print / Save as PDF captures the
// checklist alone, the same way the invoice and register documents do.
export default async function PortalChecklistDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile("client");
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job || job.deleted_at) notFound();

  const [{ data: checklists }, { data: modifications }, { data: firm }] = await Promise.all([
    supabase
      .from("checklists")
      .select("id, kind, modification_id, checklist_items(*, amendments(*), checklist_item_files(*))")
      .eq("job_id", id)
      .order("sort_order", { referencedTable: "checklist_items" })
      .order("created_at", { referencedTable: "checklist_items" }),
    supabase.from("modifications").select("*").eq("job_id", id).order("created_at"),
    supabase.from("firms").select("name, abn").eq("id", job.firm_id).single(),
  ]);

  const itemsOf = (kind: string, modificationId?: string) =>
    ((checklists || []).find((c) => c.kind === kind && (modificationId ? c.modification_id === modificationId : true))?.checklist_items as ItemWithAmendments[]) || [];

  const approvalLabel = job.pathway === "PC_OC" ? "PC Appointment" : pathwayLabel(job.pathway);

  // The document shows what the client can actually act on, so a stage
  // still locked in the portal is left out of it entirely rather than
  // printed as work that can't be started — the same rule the portal's
  // Occupation Certificate tab follows.
  const nocItems = itemsOf("noc");
  const ocLocked = nocItems.length > 0 && !nocItems.every((i) => i.status === "approved");

  const sections = [
    { title: `${approvalLabel} — documents`, items: itemsOf("pathway") },
    ...(modifications || []).map((m) => ({ title: `Modification${m.reason ? ` — ${m.reason}` : ""}`, items: itemsOf("modification", m.id) })),
    { title: "Notice of Commencement (NOC)", items: nocItems },
    ...(ocLocked ? [] : [{ title: "Occupation Certificate", items: itemsOf("oc") }]),
  ].filter((s) => s.items.length > 0);

  const all = sections.flatMap((s) => s.items);
  const outstanding = all.filter((i) => i.status !== "approved").length;

  return (
    <div className="min-h-screen bg-surface print:bg-white">
      <style>{`@page { size: A4 portrait; margin: 14mm; }
          /* Column headings repeat when a stage runs over a page. */
          @media print { thead { display: table-header-group } }`}</style>
      <div className="max-w-3xl mx-auto py-6 px-4 print:hidden flex items-center justify-between flex-wrap gap-2">
        <Link href={`/portal/jobs/${id}`} className="text-sm text-placeholder hover:text-primary">
          ← Back to the project
        </Link>
        <PrintButton label="Save as PDF" />
      </div>

      <div className="max-w-3xl mx-auto p-8 bg-white text-heading shadow-sm print:shadow-none print:max-w-none print:p-0">
        <div className="flex justify-between items-baseline border-b border-heading pb-2 mb-5">
          <div>
            <div className="text-lg font-black tracking-tight">{firm?.name}</div>
            <div className="text-sm font-semibold">Document checklist</div>
          </div>
          <div className="text-right text-xs text-muted">
            {firm?.abn && <div>ABN {firm.abn}</div>}
            <div>Prepared {formatISODate(todayISO())}</div>
          </div>
        </div>

        <div className="mb-5">
          <div className="text-base font-bold">{job.address}</div>
          <div className="text-xs text-muted">
            {pathwayLabel(job.pathway)}
            {job.description ? ` · ${job.description}` : ""}
          </div>
          <div className="text-xs text-muted mt-1">
            {checklistProgress(all)} documents approved
            {outstanding > 0 ? ` · ${outstanding} still outstanding` : " · nothing outstanding"}
          </div>
        </div>

        {sections.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="flex items-baseline justify-between border-b border-line pb-1 mb-2 break-after-avoid">
              <div className="text-sm font-bold">{section.title}</div>
              <div className="text-[11px] text-muted">{checklistProgress(section.items)} approved</div>
            </div>
            <table className="w-full text-[11px] leading-snug">
              <thead>
                <tr className="text-left border-b border-line">
                  <th className="pr-2 py-1 font-semibold w-6">#</th>
                  <th className="pr-2 py-1 font-semibold">Document</th>
                  <th className="pr-2 py-1 font-semibold w-40">Status</th>
                  <th className="py-1 font-semibold w-24">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, i) => {
                  const status = displayStatus(item);
                  const unresolved = (item.amendments || []).filter((a) => !a.resolved);
                  // The newest copy held for this item, whichever document
                  // it belongs to — the same date the portal shows.
                  const submitted = (item.checklist_item_files || [])
                    .filter((f) => f.is_current && f.file_path)
                    .map((f) => f.created_at)
                    .sort()
                    .pop();
                  return (
                    <tr key={item.id} className="border-b border-line align-top break-inside-avoid">
                      <td className="pr-2 py-1.5">{i + 1}</td>
                      <td className="pr-2 py-1.5">
                        <div className="font-semibold">{item.title}</div>
                        {item.description && <div className="text-muted">{item.description}</div>}
                        {unresolved.length > 0 && (
                          <ul className="mt-1 list-disc pl-4">
                            {unresolved.map((a) => (
                              <li key={a.id}>{a.text}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="pr-2 py-1.5">{status.label}</td>
                      <td className="py-1.5">{submitted ? formatISODate(submitted) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {sections.length === 0 && <div className="text-sm text-muted">No documents have been requested on this project yet.</div>}


        <div className="text-[10px] text-muted border-t border-line pt-2 mt-6">
          Prepared from the CertFlow client portal on {formatISODate(todayISO())}. Statuses shown are correct at the time of printing.
        </div>
      </div>
    </div>
  );
}
