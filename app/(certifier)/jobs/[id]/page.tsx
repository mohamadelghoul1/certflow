import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { checklistProgress } from "@/lib/business";
import { DetailsTab } from "@/components/certifier/DetailsTab";
import { ChecklistSection } from "@/components/certifier/ChecklistSection";
import { CertificatesPanel } from "@/components/certifier/CertificatesPanel";
import { OcPanel } from "@/components/certifier/OcPanel";
import { InspectionsPanel } from "@/components/certifier/InspectionsPanel";
import { JobTabs } from "@/components/certifier/JobTabs";
import type { Job } from "@/types/db";

function tabsFor(pathway: "CDC" | "CC") {
  return [
    { key: "details", label: "Details" },
    { key: "pathway", label: pathway },
    { key: "noc", label: "NOC" },
    { key: "inspections", label: "Inspections" },
    { key: "oc", label: "Occupation Certificate" },
  ];
}

export default async function JobDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "details" } = await searchParams;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const [
    { data: job },
    { data: checklists },
    { data: modifications },
    { data: ocRecords },
    { data: inspections },
    { data: conditions },
    { data: certifiers },
    { data: clients },
    { data: libraryItems },
    { data: pathwayVersions },
    { data: sharedAccessRows },
  ] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).eq("firm_id", profile.firm_id).single(),
    supabase.from("checklists").select("id, kind, modification_id, checklist_items(*, amendments(*))").eq("job_id", id),
    supabase.from("modifications").select("*").eq("job_id", id).order("created_at"),
    supabase.from("oc_records").select("*").eq("job_id", id).order("created_at"),
    supabase.from("inspections").select("*, defects(*), inspection_photos(*)").eq("job_id", id).order("sort_order", { referencedTable: "inspection_photos" }),
    supabase.from("conditions_of_consent").select("*").eq("job_id", id).order("created_at"),
    supabase.from("certifiers").select("*").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("clients").select("*").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("document_library_items").select("*").eq("firm_id", profile.firm_id).order("sort_order"),
    supabase.from("pathway_certificate_versions").select("*").eq("job_id", id).order("version", { ascending: false }),
    supabase.from("job_shared_access").select("client_id, clients(id, name, type)").eq("job_id", id),
  ]);
  if (!job) notFound();
  const typedJob = job as Job;
  const sharedClients = (sharedAccessRows || []).map((r) => r.clients).filter(Boolean) as unknown as { id: string; name: string; type: string }[];

  const libraries: Record<string, { title: string; description: string | null; category: string | null }[]> = { CDC: [], CC: [], NOC: [], OC: [] };
  for (const item of libraryItems || []) {
    (libraries[item.pathway] ||= []).push(item);
  }

  const pathwayChecklist = (checklists || []).find((c) => c.kind === "pathway");
  const nocChecklist = (checklists || []).find((c) => c.kind === "noc");
  const ocChecklist = (checklists || []).find((c) => c.kind === "oc");
  const modChecklistsById = new Map((checklists || []).filter((c) => c.kind === "modification").map((c) => [c.modification_id, c]));

  const modificationsWithChecklist = (modifications || []).map((m) => {
    const cl = modChecklistsById.get(m.id);
    return { ...m, checklistId: cl?.id || null, items: (cl?.checklist_items as never[]) || [] };
  });

  return (
    <div>
      <div className="mb-6">
        <Link href="/jobs" className="text-xs text-slate-400 hover:text-teal-800">
          ← All projects
        </Link>
        <h1 className="text-xl font-bold text-teal-900 mt-1">{job.address}</h1>
        <div className="text-sm text-slate-500">
          {job.pathway} · {job.description} · <span className={job.status === "complete" ? "text-emerald-700 font-medium" : ""}>{job.status === "complete" ? "Complete" : "Active"}</span>
        </div>
      </div>

      <JobTabs
        initialTab={tab}
        tabs={tabsFor(job.pathway).map((t) => ({
          ...t,
          progress:
            t.key === "pathway"
              ? checklistProgress((pathwayChecklist?.checklist_items as never[]) || [])
              : t.key === "noc"
              ? checklistProgress((nocChecklist?.checklist_items as never[]) || [])
              : t.key === "oc"
              ? checklistProgress((ocChecklist?.checklist_items as never[]) || [])
              : null,
        }))}
        content={{
          details: <DetailsTab job={typedJob} conditions={conditions || []} clients={clients || []} sharedClients={sharedClients} />,
          pathway: pathwayChecklist ? (
            <CertificatesPanel
              job={typedJob}
              firmId={profile.firm_id}
              pathwayChecklistId={pathwayChecklist.id}
              pathwayItems={(pathwayChecklist.checklist_items as never[]) || []}
              certifiers={certifiers || []}
              modifications={modificationsWithChecklist as never[]}
              library={libraries[job.pathway]}
              versions={(pathwayVersions as never[]) || []}
            />
          ) : null,
          noc: nocChecklist ? (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <ChecklistSection jobId={id} firmId={profile.firm_id} checklistId={nocChecklist.id} label="Notice of Commencement" library={libraries.NOC} items={(nocChecklist.checklist_items as never[]) || []} />
            </div>
          ) : null,
          inspections: (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <InspectionsPanel jobId={id} firmId={profile.firm_id} pathway={job.pathway} pathwayGenerated={job.pathway_generated} inspections={(inspections as never[]) || []} certifiers={certifiers || []} />
            </div>
          ),
          oc: ocChecklist ? (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <OcPanel job={typedJob} firmId={profile.firm_id} checklistId={ocChecklist.id} items={(ocChecklist.checklist_items as never[]) || []} certifiers={certifiers || []} ocRecords={ocRecords || []} library={libraries.OC} />
            </div>
          ) : null,
        }}
      />
    </div>
  );
}
