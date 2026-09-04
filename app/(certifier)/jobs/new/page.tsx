import { requireDirector } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewJobForm } from "@/components/certifier/NewJobForm";
import type { Contractor } from "@/types/db";

export default async function NewJobPage() {
  const { profile } = await requireDirector();
  const supabase = await createClient();
  const [{ data: certifiers }, { data: clients }, { data: contractors }] = await Promise.all([
    supabase.from("certifiers").select("id, name").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("clients").select("id, name, type").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("contractors").select("*").eq("firm_id", profile.firm_id).order("company"),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-primary mb-6">New project</h1>
      <NewJobForm certifiers={certifiers || []} clients={clients || []} contractors={(contractors || []) as Contractor[]} />
    </div>
  );
}
