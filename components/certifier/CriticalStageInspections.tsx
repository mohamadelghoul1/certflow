"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleCriticalStageInspection, updateCriticalStageInspection, addCriticalStageInspection, removeCriticalStageInspection } from "@/lib/actions/jobs";
import { normalizeCriticalStageInspections } from "@/lib/constants";
import { Plus, X } from "lucide-react";
import type { CriticalStageInspection } from "@/types/db";

type Action =
  | { type: "toggle"; id: string }
  | { type: "edit"; id: string; stage: string; inspector: string }
  | { type: "add"; item: CriticalStageInspection }
  | { type: "remove"; id: string };

function reducer(state: CriticalStageInspection[], action: Action): CriticalStageInspection[] {
  switch (action.type) {
    case "toggle":
      return state.map((i) => (i.id === action.id ? { ...i, enabled: !i.enabled } : i));
    case "edit":
      return state.map((i) => (i.id === action.id ? { ...i, stage: action.stage, inspector: action.inspector } : i));
    case "add":
      return [...state, action.item];
    case "remove":
      return state.filter((i) => i.id !== action.id);
  }
}

export function CriticalStageInspections({ jobId, items }: { jobId: string; items: CriticalStageInspection[] }) {
  const [list, dispatch] = useOptimistic(normalizeCriticalStageInspections(items), reducer);
  const [, startTransition] = useTransition();

  function handleToggle(id: string) {
    startTransition(async () => {
      dispatch({ type: "toggle", id });
      const fd = new FormData();
      fd.set("job_id", jobId);
      fd.set("id", id);
      await toggleCriticalStageInspection(fd);
    });
  }

  function handleEdit(id: string, stage: string, inspector: string) {
    startTransition(async () => {
      dispatch({ type: "edit", id, stage, inspector });
      const fd = new FormData();
      fd.set("job_id", jobId);
      fd.set("id", id);
      fd.set("stage", stage);
      fd.set("inspector", inspector);
      await updateCriticalStageInspection(fd);
    });
  }

  function handleAdd(stage: string, inspector: string) {
    const item: CriticalStageInspection = { id: `temp-${Math.random().toString(36).slice(2)}`, stage, inspector, enabled: true };
    startTransition(async () => {
      dispatch({ type: "add", item });
      const fd = new FormData();
      fd.set("job_id", jobId);
      fd.set("stage", stage);
      fd.set("inspector", inspector);
      await addCriticalStageInspection(fd);
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      dispatch({ type: "remove", id });
      const fd = new FormData();
      fd.set("job_id", jobId);
      fd.set("id", id);
      await removeCriticalStageInspection(fd);
    });
  }

  return (
    <div className="space-y-2">
      {list.map((insp, idx) => (
        <InspectionRow
          key={insp.id}
          index={idx + 1}
          insp={insp}
          onToggle={() => handleToggle(insp.id)}
          onEdit={(stage, inspector) => handleEdit(insp.id, stage, inspector)}
          onRemove={() => handleRemove(insp.id)}
        />
      ))}
      <AddInspectionForm onAdd={handleAdd} />
    </div>
  );
}

function InspectionRow({
  index,
  insp,
  onToggle,
  onEdit,
  onRemove,
}: {
  index: number;
  insp: CriticalStageInspection;
  onToggle: () => void;
  onEdit: (stage: string, inspector: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [stage, setStage] = useState(insp.stage);
  const [inspector, setInspector] = useState(insp.inspector);

  function save() {
    const trimmed = stage.trim();
    setEditing(false);
    if (!trimmed) {
      setStage(insp.stage);
      return;
    }
    onEdit(trimmed, inspector.trim());
  }

  if (editing) {
    return (
      <div
        className="rounded-md border border-teal-200 bg-teal-50/40 p-2 space-y-1.5"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) save();
        }}
      >
        <input
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          autoFocus
          placeholder="Stage"
          className="w-full text-sm outline-none bg-white rounded px-2 py-1 border border-slate-200"
        />
        <input
          value={inspector}
          onChange={(e) => setInspector(e.target.value)}
          placeholder="Inspector"
          className="w-full text-xs outline-none bg-white rounded px-2 py-1 border border-slate-200"
        />
        <div className="flex gap-2">
          <button onClick={save} className="text-xs font-semibold text-teal-800 hover:underline">
            Save
          </button>
          <button
            onClick={() => {
              setStage(insp.stage);
              setInspector(insp.inspector);
              setEditing(false);
            }}
            className="text-xs text-slate-400 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={insp.enabled} onChange={onToggle} className="mt-0.5 accent-teal-700 shrink-0" />
      <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left">
        {index}. {insp.stage} <span className="text-slate-400">({insp.inspector})</span>
      </button>
      <button onClick={onRemove} className="p-0.5 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0">
        <X size={13} />
      </button>
    </div>
  );
}

function AddInspectionForm({ onAdd }: { onAdd: (stage: string, inspector: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [stage, setStage] = useState("");
  const [inspector, setInspector] = useState("");

  function submit() {
    const trimmed = stage.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    onAdd(trimmed, inspector.trim());
    setStage("");
    setInspector("");
    setAdding(false);
  }

  if (!adding) {
    return (
      <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:underline mt-1">
        <Plus size={13} /> Add inspection
      </button>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 p-2 space-y-1.5 mt-1">
      <input
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        autoFocus
        placeholder="Stage (e.g. Prior to pouring slab)"
        className="w-full text-sm outline-none bg-white rounded px-2 py-1 border border-slate-200"
      />
      <input
        value={inspector}
        onChange={(e) => setInspector(e.target.value)}
        placeholder="Inspector (e.g. Registered Certifier)"
        className="w-full text-xs outline-none bg-white rounded px-2 py-1 border border-slate-200"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs font-semibold text-teal-800 hover:underline">
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setStage("");
            setInspector("");
          }}
          className="text-xs text-slate-400 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
