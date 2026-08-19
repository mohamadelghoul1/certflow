import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/certifier/NavBar";

export default async function CertifierLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const { data: firm } = await supabase.from("firms").select("name").eq("id", profile.firm_id).single();

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar firmName={firm?.name || ""} />
      <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
