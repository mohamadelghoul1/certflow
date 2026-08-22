import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewQuoteForm } from "@/components/certifier/NewQuoteForm";

export default async function NewQuotePage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const [{ data: certifiers }, { data: clients }] = await Promise.all([
    supabase.from("certifiers").select("id, name").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("clients").select("id, name, type").eq("firm_id", profile.firm_id).order("name"),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-primary mb-6">New quote</h1>
      <NewQuoteForm certifiers={certifiers || []} clients={clients || []} />
    </div>
  );
}
