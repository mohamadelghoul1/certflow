import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DemoBanner } from "@/components/DemoBanner";
import { signOut } from "@/lib/actions/auth";
import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile("client");
  // The portal is half of any demonstration — the certifier being shown
  // Certlyn wants to see what their client sees — so the bar belongs
  // here too. select("*") for the same reason as everywhere else: a
  // database without migration 0075 has no such column.
  const supabase = await createClient();
  const { data: firm } = await supabase.from("firms").select("*").eq("id", profile.firm_id).maybeSingle();

  return (
    <div className="min-h-screen bg-surface">
      {(firm as { demo?: boolean } | null)?.demo === true && <DemoBanner />}
      <div className="bg-primary-700 text-white px-6 py-4 flex items-center justify-between">
        <Link href="/portal" className="font-serif font-bold tracking-wide text-lg">
          CERTLYN
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-icon-300 text-sm hidden sm:inline">{profile.full_name || profile.email}</span>
          <form action={signOut}>
            <SubmitButton className="text-xs text-icon-300 hover:text-white">Sign out</SubmitButton>
          </form>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
