// A director's sign-off before a team member issues a certificate.
//
// A team member prepares the CDC, CC, modified certificate or OC in
// full and then asks; a director says yes or no; the yes covers that
// one issue and is spent by it. Directors are not asked — they are the
// approval. Enforced by the database (migration 0074); what is here is
// how the screens read the same facts.

export type IssueStage = "pathway" | "oc";

export type ApprovalRow = {
  id: string;
  stage: string;
  status: string;
  requested_by: string | null;
  requested_at: string;
  request_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  used_at: string | null;
};

export type ApprovalState =
  | { state: "not-needed" }
  | { state: "none" }
  | { state: "pending"; row: ApprovalRow }
  | { state: "approved"; row: ApprovalRow }
  | { state: "declined"; row: ApprovalRow };

export function isIssueStage(value: unknown): value is IssueStage {
  return value === "pathway" || value === "oc";
}

// The live request for a stage, if any: a spent one is history, and a
// declined one is only worth showing until a fresh request is made.
export function approvalFor(rows: ApprovalRow[], stage: IssueStage, needsApproval: boolean): ApprovalState {
  if (!needsApproval) return { state: "not-needed" };
  const forStage = rows.filter((r) => r.stage === stage);
  const open = forStage.find((r) => !r.used_at && (r.status === "pending" || r.status === "approved"));
  if (open) return open.status === "approved" ? { state: "approved", row: open } : { state: "pending", row: open };
  // A decline stands until it is asked again, which the button offers.
  const declined = [...forStage].filter((r) => r.status === "declined").sort((a, b) => (a.decided_at || "") < (b.decided_at || "") ? 1 : -1)[0];
  if (declined) return { state: "declined", row: declined };
  return { state: "none" };
}

// May this person press Issue right now?
export function canIssueNow(state: ApprovalState): boolean {
  return state.state === "not-needed" || state.state === "approved";
}

export function stageLabel(stage: IssueStage, pathway: string): string {
  return stage === "oc" ? "Occupation Certificate" : pathway === "PC_OC" ? "certificate" : pathway;
}
