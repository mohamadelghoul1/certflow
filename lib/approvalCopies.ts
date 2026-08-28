import type { ClientApprovalCopy } from "@/types/db";

// Which of a job's client-sent copies belong beside which certificate.
//
// A job can carry a copy of its CDC/CC and a copy of each Occupation
// Certificate, so the whole set is read once for the page and split up
// here — putting an OC copy under the CDC, or one OC's copy under
// another's, would be worse than showing none.
export function approvalCopiesFor<T extends Pick<ClientApprovalCopy, "kind" | "oc_record_id">>(
  copies: T[],
  kind: "pathway" | "oc",
  ocRecordId?: string | null
): T[] {
  if (kind === "pathway") return copies.filter((c) => c.kind === "pathway");
  return copies.filter((c) => c.kind === "oc" && !!ocRecordId && c.oc_record_id === ocRecordId);
}
