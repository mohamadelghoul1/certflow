"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addAmendment, resolveAmendment, removeAmendment } from "@/lib/actions/jobs";
import type { Amendment } from "@/types/db";

type AmendAction = { type: "add"; amendment: Amendment } | { type: "resolve"; id: string } | { type: "remove"; id: string };

function reducer(state: Amendment[], action: AmendAction): Amendment[] {
  switch (action.type) {
    case "add":
      return [...state, action.amendment];
    case "resolve":
      return state.map((a) => (a.id === action.id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a));
    case "remove":
      return state.filter((a) => a.id !== action.id);
  }
}

export function AmendmentsList({ itemId, jobId, amendments }: { itemId: string; jobId: string; amendments: Amendment[] }) {
  const [list, dispatch] = useOptimistic(amendments, reducer);
  const [, startTransition] = useTransition();
  const [text, setText] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    const temp: Amendment = { id: `temp-${Math.random().toString(36).slice(2)}`, checklist_item_id: itemId, text: trimmed, resolved: false, created_at: new Date().toISOString(), resolved_at: null };
    startTransition(async () => {
      dispatch({ type: "add", amendment: temp });
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("job_id", jobId);
      fd.set("text", trimmed);
      await addAmendment(fd);
    });
    setText("");
  }

  function handleResolve(id: string) {
    startTransition(async () => {
      dispatch({ type: "resolve", id });
      const fd = new FormData();
      fd.set("amendment_id", id);
      fd.set("job_id", jobId);
      await resolveAmendment(fd);
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      dispatch({ type: "remove", id });
      const fd = new FormData();
      fd.set("amendment_id", id);
      fd.set("job_id", jobId);
      await removeAmendment(fd);
    });
  }

  return (
    <>
      {list.length > 0 && (
        <div className="mt-3 space-y-2">
          {list.map((a) => (
            <div key={a.id} className={`text-xs rounded-md px-3 py-2 flex items-start justify-between gap-3 ${a.resolved ? "bg-surface text-placeholder" : "bg-warning-bg text-warning-text"}`}>
              <span className={a.resolved ? "line-through" : ""}>{a.text}</span>
              {!a.resolved && (
                <button onClick={() => handleResolve(a.id)} className="font-semibold hover:underline shrink-0">
                  Resolve
                </button>
              )}
              {a.resolved && (
                <button onClick={() => handleRemove(a.id)} className="font-semibold hover:underline hover:text-error shrink-0">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        {/* id is how "Request modification" up in the action row jumps
            straight here, rather than that button duplicating this input. */}
        <input
          id={`amendment-input-${itemId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an amendment point…"
          className="flex-1 px-2 py-1.5 rounded border border-line text-xs"
        />
        <button type="submit" className="text-xs font-semibold text-warning-text hover:underline">
          Add
        </button>
      </form>
    </>
  );
}
