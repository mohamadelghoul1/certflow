import { requireDirector } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewJobForm } from "@/components/certifier/NewJobForm";
import type { Contractor } from "@/types/db";
import { OverageNoticeCard } from "@/components/certifier/OverageNotice";
import { overageNotice, monthKey, type FirmPlan } from "@/lib/billing";

export default async function NewJobPage() {
  const { profile } = await requireDirector();
  const supabase = await createClient();
  const month = monthKey();
  const [{ data: certifiers }, { data: clients }, { data: contractors }, { data: planRow }, { data: usedRow }] = await Promise.all([
    supabase.from("certifiers").select("id, name").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("clients").select("id, name, type").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("contractors").select("*").eq("firm_id", profile.firm_id).order("company"),
    // What their subscription covers, and how much of it this month has
    // used. Both are absent on a database without migration 0076, and
    // then nothing is said rather than a figure being guessed at.
    supabase.from("firm_plans").select("*").eq("firm_id", profile.firm_id).maybeSingle(),
    supabase.rpc("my_firm_usage", { p_month: month }),
  ]);
  const notice = overageNotice((planRow as FirmPlan | null) ?? null, Number(usedRow ?? 0), month);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-primary mb-6">New project</h1>
      <OverageNoticeCard notice={notice} />
      <NewJobForm certifiers={certifiers || []} clients={clients || []} contractors={(contractors || []) as Contractor[]} />
    </div>
  );
}
