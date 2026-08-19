import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function JobsListPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, address, description, pathway, status")
    .eq("firm_id", profile.firm_id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-teal-900">Jobs</h1>
        <Link href="/jobs/new" className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
          + New job
        </Link>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {(jobs || []).map((j) => (
          <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between px-5 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
            <div>
              <div className="font-semibold text-sm text-teal-900">{j.address}</div>
              <div className="text-xs text-slate-500">
                {j.pathway} · {j.description}
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${j.status === "complete" ? "bg-emerald-50 text-emerald-700" : "bg-teal-50 text-teal-700"}`}>
              {j.status === "complete" ? "Complete" : "Active"}
            </span>
          </Link>
        ))}
        {(jobs || []).length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400">No jobs yet.</div>}
      </div>
    </div>
  );
}
