import { pathwayLabel, type Pathway } from "@/lib/business";

// What a project is still waiting on, stage by stage.
//
// The checklists already hold the answer — every document was requested
// through one — so "what is still needed" is read off them rather than
// judged. That is deliberate: this list ends up in front of a client and
// behind a certificate, and it must be the certifier's decision about
// which documents a project needs, made when the checklist was drawn
// up, never anything inferred later. The AI summary built on top of it
// (lib/ai/outstandingSummary) only ever describes the items here; it is
// never allowed to add one or take one away.

export type OutstandingState =
  // Asked for and nothing has arrived.
  | "not_received"
  // Arrived, and sent back with a note that has not been resolved.
  | "needs_changes"
  // Uploaded and waiting on the certifier — the client has done their
  // part, so this is shown but never chased.
  | "with_certifier";

export type OutstandingItem = {
  title: string;
  // The library's own explanation of the document, when the item came
  // from it. The fallback wording when no AI is available to write one.
  description: string | null;
  state: OutstandingState;
  // The firm's own step (a peer review, a fee), invisible to the client.
  internal: boolean;
};

export type OutstandingStage = { key: string; label: string; items: OutstandingItem[] };

type ItemRow = {
  title: string;
  description?: string | null;
  status: string;
  internal?: boolean | null;
  amendments?: { resolved: boolean }[] | null;
};

export type OutstandingChecklistRow = { kind: string; modification_id?: string | null; checklist_items?: ItemRow[] | null };

const KIND_ORDER = ["pathway", "modification", "noc", "oc"];

export function stageLabel(kind: string, pathway: Pathway, modificationNumber?: number): string {
  if (kind === "pathway") {
    // A PC/OC job holds no application of its own — its first checklist
    // is the approval another certifier issued.
    return pathway === "PC_OC" ? "Approval documents" : `${pathwayLabel(pathway)} application`;
  }
  if (kind === "noc") return "Notice of Commencement";
  if (kind === "oc") return "Occupation Certificate";
  const n = modificationNumber && modificationNumber > 1 ? ` ${modificationNumber}` : "";
  return pathway === "PC_OC" ? `Modification${n}` : `Modified ${pathwayLabel(pathway)}${n}`;
}

function stateOf(item: ItemRow): OutstandingState | null {
  if ((item.amendments || []).some((a) => !a.resolved)) return "needs_changes";
  if (item.status === "requested") return "not_received";
  if (item.status === "submitted") return "with_certifier";
  return null;
}

// Every stage with something still open, in the order the job moves
// through them. A stage with nothing outstanding is left out entirely —
// an empty heading reads as a document somebody forgot to list.
export function outstandingStages(checklists: OutstandingChecklistRow[], pathway: Pathway): OutstandingStage[] {
  const ordered = [...checklists].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  const stages: OutstandingStage[] = [];
  let modifications = 0;

  for (const checklist of ordered) {
    const items: OutstandingItem[] = [];
    for (const item of checklist.checklist_items || []) {
      const state = stateOf(item);
      if (!state) continue;
      items.push({ title: item.title, description: item.description || null, state, internal: item.internal === true });
    }
    if (checklist.kind === "modification") modifications++;
    if (items.length === 0) continue;
    const key = checklist.kind === "modification" ? `modification-${checklist.modification_id || modifications}` : checklist.kind;
    stages.push({ key, label: stageLabel(checklist.kind, pathway, modifications), items });
  }
  return stages;
}

export function outstandingTotal(stages: OutstandingStage[]): number {
  return stages.reduce((sum, s) => sum + s.items.length, 0);
}

// The part of the list that is the client's to act on: nothing internal,
// and nothing already sitting with the certifier. This is what the
// summary is written about, because a client told to chase a document
// they have already sent stops reading the rest.
export function clientFacing(stages: OutstandingStage[]): OutstandingStage[] {
  return stages
    .map((stage) => ({ ...stage, items: stage.items.filter((i) => !i.internal && i.state !== "with_certifier") }))
    .filter((stage) => stage.items.length > 0);
}
