import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { excludingDeleted } from "@/lib/softDelete";
import { NavBar } from "@/components/certifier/NavBar";
import { MobileTabBar } from "@/components/certifier/MobileTabBar";
import { UploadAlerts } from "@/components/certifier/UploadAlerts";

export default async function CertifierLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const [{ data: firm }, { data: recentJobs }, { data: recentQuotes }] = await Promise.all([
    supabase.from("firms").select("name").eq("id", profile.firm_id).single(),
    excludingDeleted((live) => {
      const query = supabase.from("jobs").select("id, address, description").eq("firm_id", profile.firm_id);
      return (live ? query.is("deleted_at", null) : query).order("created_at", { ascending: false }).limit(6);
    }),
    supabase.from("quotes").select("id, proposal_address, project_title").eq("firm_id", profile.firm_id).order("created_at", { ascending: false }).limit(6),
  ]);

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <NavBar
        firmName={firm?.name || ""}
        userName={profile.full_name || profile.email || "Certifier"}
        recentJobs={(recentJobs || []).map((j) => ({ id: j.id, title: j.address, subtitle: j.description || "" }))}
        recentQuotes={(recentQuotes || []).map((q) => ({ id: q.id, title: q.proposal_address || q.project_title || "Untitled quote", subtitle: q.project_title && q.proposal_address ? q.project_title : "" }))}
      />
      {/* Bottom padding on phones clears the fixed tab bar, so the last
          card on a page isn't sitting underneath it. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">{children}</div>
      <MobileTabBar />
      <UploadAlerts />
    </div>
  );
}
