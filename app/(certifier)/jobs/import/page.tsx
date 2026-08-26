import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImportJobsForm } from "@/components/certifier/ImportJobsForm";

// Bringing a firm's existing jobs across from the system they used
// before, so the inspections and the occupation certificates can be done
// here without typing three hundred projects in by hand.
export default async function ImportJobsPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const { data: certifiers } = await supabase.from("certifiers").select("id, name").eq("firm_id", profile.firm_id).order("name");

  return (
    <div>
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-placeholder hover:text-muted mb-4">
        <ArrowLeft size={15} /> Back to projects
      </Link>
      <h1 className="text-xl font-bold text-primary mb-1">Import projects from another system</h1>
      <p className="text-placeholder text-sm mb-6 max-w-3xl">
        For jobs already under construction elsewhere. Each one comes in as a Principal Certifier / OC project with the previous certifier&rsquo;s approval recorded against it, ready for
        inspections and the Occupation Certificate.
      </p>
      <ImportJobsForm certifiers={certifiers || []} />
    </div>
  );
}
