"use client";

import { createContext, useContext, useOptimistic, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { moveInspection } from "@/lib/actions/inspections";
import { reorderedIds } from "@/lib/checklists";

// Moving an inspection up or down, the same way the checklist documents
// move. Held as optimistic state so the card moves on the press rather
// than after the job page has been rebuilt and streamed back; if the save
// fails, React drops the optimistic order and the list snaps back to what
// the server actually has.

type Ctx = { order: string[]; move: (id: string, direction: "up" | "down") => void };
const InspectionOrderContext = createContext<Ctx | null>(null);

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
  const [order, applyMove] = useOptimistic(serverOrder, (current: string[], move: { id: string; direction: "up" | "down" }) =>
    reorderedIds(current, move.id, move.direction) ?? current
  );
  const [, startTransition] = useTransition();

  function move(id: string, direction: "up" | "down") {
    startTransition(async () => {
      applyMove({ id, direction });
      const fd = new FormData();
      fd.set("inspection_id", id);
      fd.set("job_id", jobId);
      fd.set("direction", direction);
      await moveInspection(fd);
    });
  }

  const nodeById = new Map(rows.map((r) => [r.id, r.node]));

  return (
    <InspectionOrderContext.Provider value={{ order, move }}>
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
