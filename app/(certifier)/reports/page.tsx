import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getIssuanceEvents } from "@/lib/reporting";
import { ReportsView } from "@/components/certifier/ReportsView";

export default async function ReportsPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const events = await getIssuanceEvents(supabase, profile.firm_id);

  return <ReportsView events={events.map((e) => ({ type: e.type, date: e.date.toISOString() }))} />;
}
