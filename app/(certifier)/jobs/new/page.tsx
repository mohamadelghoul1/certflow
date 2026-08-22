import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewJobForm } from "@/components/certifier/NewJobForm";

export default async function NewJobPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const [{ data: certifiers }, { data: clients }] = await Promise.all([
    supabase.from("certifiers").select("id, name").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("clients").select("id, name, type").eq("firm_id", profile.firm_id).order("name"),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-primary mb-6">New project</h1>
      <NewJobForm certifiers={certifiers || []} clients={clients || []} />
    </div>
  );
}
