import { pathwayLabel } from "@/lib/business";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PortalHomePage() {
  const { profile } = await requireProfile("client");
  const supabase = await createClient();

  const { data: direct } = await supabase.from("jobs").select("id, address, description, pathway, status").eq("client_id", profile.client_id);
  const { data: shared } = await supabase
    .from("job_shared_access")
    .select("jobs(id, address, description, pathway, status)")
    .eq("client_id", profile.client_id);

  const sharedJobs = (shared || []).map((s) => s.jobs).filter(Boolean) as unknown as { id: string; address: string; description: string; pathway: string; status: string }[];
  const jobs = [...(direct || []), ...sharedJobs];

  return (
    <div>
      <h1 className="text-xl font-bold text-primary mb-6">Your projects</h1>
      <div className="bg-white rounded-lg border border-line overflow-hidden">
        {jobs.map((j) => (
          <Link key={j.id} href={`/portal/jobs/${j.id}`} className="flex items-center justify-between px-5 py-4 border-b border-line last:border-b-0 hover:bg-hover">
            <div>
              <div className="font-semibold text-sm text-primary">{j.address}</div>
              <div className="text-xs text-placeholder">
                {pathwayLabel(j.pathway)} · {j.description}
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${j.status === "complete" ? "bg-success-bg text-success" : "bg-hover text-secondary"}`}>
              {j.status === "complete" ? "Complete" : "Active"}
            </span>
          </Link>
        ))}
        {jobs.length === 0 && <div className="px-5 py-8 text-center text-sm text-placeholder">No projects linked to your account yet.</div>}
      </div>
    </div>
  );
}
