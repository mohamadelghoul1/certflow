import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireDirector } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatISODate } from "@/lib/business";
import { isUnknownColumn } from "@/lib/softDelete";
import { DeletedJobRow } from "@/components/certifier/DeletedJobRow";

// Deleted projects are still here — they are just hidden everywhere else.
// This is where they come back from, and the only place they can be
// destroyed for good.
export default async function DeletedJobsPage() {
  const { profile } = await requireDirector();
  const supabase = await createClient();

  const [{ data: jobs, error }, { data: people }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, address, description, deleted_at, deleted_by")
      .eq("firm_id", profile.firm_id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").eq("firm_id", profile.firm_id),
  ]);

  const nameFor = new Map((people || []).map((p) => [p.id, p.full_name || p.email || ""]));
  const rows = (jobs || []) as { id: string; address: string; description: string | null; deleted_at: string; deleted_by: string | null }[];

  return (
    <div>
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-placeholder hover:text-muted mb-4">
        <ArrowLeft size={15} /> Back to projects
      </Link>
      <h1 className="text-xl font-bold text-primary mb-1">Deleted projects</h1>
      <p className="text-placeholder text-sm mb-6 max-w-2xl">
        Nothing here has been thrown away yet. Every document, inspection and certificate is still attached, and restoring a project puts it back exactly as it was.
        Thirty days after it was deleted, a project is removed for good — documents included — so it stops counting against your storage.
      </p>

      {error && isUnknownColumn(error) ? (
        <div className="rounded-lg border border-warning/50 bg-warning-bg px-5 py-4 text-sm text-warning-text max-w-2xl">
          This database has not had migration 0028 run against it yet, so deleting a project is not recoverable and there is nothing to list here. Run it in Supabase and this page starts
          working.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-line overflow-hidden max-w-4xl">
          {rows.map((j) => (
            <DeletedJobRow
              key={j.id}
              jobId={j.id}
              address={j.address}
              description={j.description || ""}
              deletedAt={formatISODate(j.deleted_at)}
              deletedBy={(j.deleted_by && nameFor.get(j.deleted_by)) || ""}
            />
          ))}
          {rows.length === 0 && <div className="px-5 py-10 text-center text-sm text-placeholder">No deleted projects.</div>}
        </div>
      )}
    </div>
  );
}
