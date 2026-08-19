import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAuditEvents } from "@/lib/reporting";
import { AuditView } from "@/components/certifier/AuditView";

export default async function AuditPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const [events, { data: certifiers }] = await Promise.all([
    getAuditEvents(supabase, profile.firm_id),
    supabase.from("certifiers").select("id, name, registration_no, registration_body").eq("firm_id", profile.firm_id).order("name"),
  ]);

  return <AuditView certifiers={certifiers || []} events={events} />;
}
