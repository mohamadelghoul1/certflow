import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/certifier/NavBar";

export default async function CertifierLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const [{ data: firm }, { data: recentJobs }, { data: recentQuotes }] = await Promise.all([
    supabase.from("firms").select("name").eq("id", profile.firm_id).single(),
    supabase.from("jobs").select("id, address, description").eq("firm_id", profile.firm_id).order("created_at", { ascending: false }).limit(6),
    supabase.from("quotes").select("id, proposal_address, project_title").eq("firm_id", profile.firm_id).order("created_at", { ascending: false }).limit(6),
  ]);

  return (
    <div className="min-h-screen bg-surface">
      <NavBar
        firmName={firm?.name || ""}
        userName={profile.full_name || profile.email || "Certifier"}
        recentJobs={(recentJobs || []).map((j) => ({ id: j.id, title: j.address, subtitle: j.description || "" }))}
        recentQuotes={(recentQuotes || []).map((q) => ({ id: q.id, title: q.proposal_address || q.project_title || "Untitled quote", subtitle: q.project_title && q.proposal_address ? q.project_title : "" }))}
      />
      <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
