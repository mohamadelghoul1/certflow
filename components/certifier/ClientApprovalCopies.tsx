import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { formatISODate } from "@/lib/business";
import { FileCheck2 } from "lucide-react";
import type { ClientApprovalCopy } from "@/types/db";

// Copies of the issued certificate that the client has sent in from
// their portal — the council's stamped return, the Planning Portal's
// endorsed version, a scan of the signed original.
//
// Shown beside the firm's own issued file, never in place of it. Reads
// tolerantly: a database that hasn't had migration 0046 run simply shows
// nothing here rather than breaking the job screen.
export async function ClientApprovalCopies({ jobId, kind, ocRecordId }: { jobId: string; kind: "pathway" | "oc"; ocRecordId?: string }) {
  const supabase = await createClient();
  let query = supabase.from("client_approval_copies").select("*").eq("job_id", jobId).eq("kind", kind).order("created_at");
  query = kind === "oc" && ocRecordId ? query.eq("oc_record_id", ocRecordId) : query;
  const { data, error } = await query;
  if (error) return null;

  const copies = (data || []) as ClientApprovalCopy[];
  if (copies.length === 0) return null;

  const urls = await Promise.all(copies.map((c) => signedUrl(c.file_path)));

  return (
    <div className="mt-3 pt-3 border-t border-line">
      <div className="text-xs font-semibold text-heading mb-1.5">Client&rsquo;s copy</div>
      <div className="space-y-1">
        {copies.map((copy, i) => (
          <div key={copy.id} className="flex items-center gap-2 text-xs text-muted">
            <FileCheck2 size={13} className="text-success shrink-0" />
            {urls[i] ? (
              <a href={urls[i]!} target="_blank" rel="noreferrer" className="font-semibold text-secondary hover:underline">
                {copy.file_name || "Copy of the certificate"}
              </a>
            ) : (
              <span className="font-semibold">{copy.file_name || "Copy of the certificate"}</span>
            )}
            <span>· sent {formatISODate(copy.created_at.slice(0, 10))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
