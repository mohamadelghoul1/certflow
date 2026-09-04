import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { excludingDeleted } from "@/lib/softDelete";
import { NavBar } from "@/components/certifier/NavBar";
import { MobileTabBar } from "@/components/certifier/MobileTabBar";
import { UploadAlerts } from "@/components/certifier/UploadAlerts";
import { DemoBanner } from "@/components/DemoBanner";
import { isPlatformOwner } from "@/lib/platformOwner";

export default async function CertifierLayout({ children }: { children: React.ReactNode }) {
  const { profile, director } = await requireProfile("certifier");
  const supabase = await createClient();
  const [{ data: firm }, { data: recentJobs }, { data: recentQuotes }, platformOwner] = await Promise.all([
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
    excludingDeleted((live) => {
      const query = supabase.from("jobs").select("id, address, description").eq("firm_id", profile.firm_id);
      return (live ? query.is("deleted_at", null) : query).order("created_at", { ascending: false }).limit(6);
    }),
    supabase.from("quotes").select("id, proposal_address, project_title").eq("firm_id", profile.firm_id).order("created_at", { ascending: false }).limit(6),
    // The Firms page belongs to whoever runs Certlyn, and only a
    // director of that firm sees the link at all.
    director ? isPlatformOwner(supabase, profile.firm_id) : Promise.resolve(false),
  ]);

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      {firm?.demo === true && <DemoBanner firmName={firm?.name || ""} />}
      <NavBar
        platformOwner={platformOwner}
        director={director}
        firmName={firm?.name || ""}
        userName={profile.full_name || profile.email || "Certifier"}
        recentJobs={(recentJobs || []).map((j) => ({ id: j.id, title: j.address, subtitle: j.description || "" }))}
        recentQuotes={(recentQuotes || []).map((q) => ({ id: q.id, title: q.proposal_address || q.project_title || "Untitled quote", subtitle: q.project_title && q.proposal_address ? q.project_title : "" }))}
      />
      {/* Bottom padding on phones clears the fixed tab bar, so the last
          card on a page isn't sitting underneath it. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">{children}</div>
      <MobileTabBar director={director} />
      <UploadAlerts />
    </div>
  );
}
