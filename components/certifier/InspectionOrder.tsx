"use client";

import { createContext, useContext, useOptimistic, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { moveInspection } from "@/lib/actions/inspections";
import { reorderedIds } from "@/lib/checklists";

// The list of inspections on a job: which order they sit in, and which
// of them are still there. Both are held as optimistic state so a card
// moves — or goes — on the press, rather than after the job page has been
// rebuilt and streamed back. If the save fails, React drops the
// optimistic value and the list snaps back to what the server has.

type ListAction = { type: "move"; id: string; direction: "up" | "down" } | { type: "remove"; id: string };

function reducer(order: string[], action: ListAction): string[] {
  if (action.type === "remove") return order.filter((id) => id !== action.id);
  return reorderedIds(order, action.id, action.direction) ?? order;
}

type Ctx = { order: string[]; move: (id: string, direction: "up" | "down") => void; remove: (id: string) => void };
const InspectionOrderContext = createContext<Ctx | null>(null);

// Used by the Remove button, which lives on the card rather than here —
// the card it removes is one of the nodes this component is rendering, so
// the list is what has to forget it.
export function useInspectionList() {
  return useContext(InspectionOrderContext);
}

export function InspectionOrderProvider({
  jobId,
  rows,
}: {
  jobId: string;
  // Each card, rendered on the server (it needs signed file links) and
  // passed through here so this component only decides the order.
  rows: { id: string; node: React.ReactNode }[];
}) {
  const serverOrder = rows.map((r) => r.id);

  // The reducer form, so two quick presses stack instead of the second
  // being computed from the pre-move order and undoing the first.
  const [order, apply] = useOptimistic(serverOrder, reducer);
  const [, startTransition] = useTransition();

  function move(id: string, direction: "up" | "down") {
    startTransition(async () => {
      apply({ type: "move", id, direction });
      const fd = new FormData();
      fd.set("inspection_id", id);
      fd.set("job_id", jobId);
      fd.set("direction", direction);
      await moveInspection(fd);
    });
  }

  const nodeById = new Map(rows.map((r) => [r.id, r.node]));

  // The Remove button owns the call itself — it has to read the error
  // back when the Portal has been told about this inspection and it can no
  // longer be removed — so this only takes the card off the list, and puts
  // it back if the removal is refused.
  const remove = (id: string) => apply({ type: "remove", id });

  return (
    <InspectionOrderContext.Provider value={{ order, move, remove }}>
      {order.map((id) => (
        <div key={id}>{nodeById.get(id)}</div>
      ))}
    </InspectionOrderContext.Provider>
  );
}

// Rendered inside each card. Nothing at all outside a provider, so a card
// shown without an orderable list around it simply has no arrows rather
// than throwing.
export function InspectionMoveButtons({ inspectionId }: { inspectionId: string }) {
  const ctx = useContext(InspectionOrderContext);
  if (!ctx) return null;

  const index = ctx.order.indexOf(inspectionId);
  return (
    <div className="flex flex-col">
      <Arrow direction="up" disabled={index <= 0} onPress={() => ctx.move(inspectionId, "up")} />
      <Arrow direction="down" disabled={index === -1 || index >= ctx.order.length - 1} onPress={() => ctx.move(inspectionId, "down")} />
    </div>
  );
}

function Arrow({ direction, disabled, onPress }: { direction: "up" | "down"; disabled: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      title={direction === "up" ? "Move up" : "Move down"}
      className="flex items-center justify-center w-6 h-5 rounded text-placeholder hover:text-primary hover:bg-hover disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-default"
    >
      {direction === "up" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  );
}
