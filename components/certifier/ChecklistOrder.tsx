"use client";

import { createContext, useContext, useOptimistic, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { moveChecklistItem } from "@/lib/actions/jobs";
import { reorderedIds } from "@/lib/checklists";

// Moving a document up or down changes the order the approved set is
// assembled in, so the move has to be saved. Waiting for that save before
// showing anything made the arrows feel broken — a press, a pause, then
// the row jumps. The list is held here as optimistic state instead: the
// row moves on the press and the save happens behind it. If the save
// fails, React drops the optimistic order and the list snaps back to what
// the server actually has.
type Ctx = {
  order: string[];
  move: (itemId: string, direction: "up" | "down") => void;
};

const ChecklistOrderContext = createContext<Ctx | null>(null);

export function ChecklistOrderProvider({
  jobId,
  rows,
}: {
  jobId: string;
  // Each item's card, rendered on the server (it needs signed file links)
  // and passed through here so this component only decides the order.
  rows: { id: string; node: React.ReactNode }[];
}) {
  const serverOrder = rows.map((r) => r.id);

  // The reducer form, so two quick presses stack instead of the second
  // being computed from the pre-move order and undoing the first.
  const [order, applyMove] = useOptimistic(serverOrder, (current: string[], move: { itemId: string; direction: "up" | "down" }) =>
    reorderedIds(current, move.itemId, move.direction) ?? current
  );
  const [, startTransition] = useTransition();

  function move(itemId: string, direction: "up" | "down") {
    startTransition(async () => {
      applyMove({ itemId, direction });
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("job_id", jobId);
      fd.set("direction", direction);
      await moveChecklistItem(fd);
    });
  }

  const nodeById = new Map(rows.map((r) => [r.id, r.node]));

  return (
    <ChecklistOrderContext.Provider value={{ order, move }}>
      {order.map((id) => (
        <div key={id}>{nodeById.get(id)}</div>
      ))}
    </ChecklistOrderContext.Provider>
  );
}

// Rendered inside each card. Falls back to nothing at all outside a
// provider, so a card shown somewhere without an orderable list around it
// simply has no arrows rather than throwing.
export function MoveButtons({ itemId }: { itemId: string }) {
  const ctx = useContext(ChecklistOrderContext);
  if (!ctx) return null;

  const index = ctx.order.indexOf(itemId);
  return (
    <div className="flex flex-col">
      <Arrow direction="up" disabled={index <= 0} onPress={() => ctx.move(itemId, "up")} />
      <Arrow direction="down" disabled={index === -1 || index >= ctx.order.length - 1} onPress={() => ctx.move(itemId, "down")} />
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
