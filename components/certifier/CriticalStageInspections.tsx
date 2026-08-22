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
      return state.map((i) => (i.id === action.id ? { ...i, stage: action.stage, inspector: action.inspector, enabled: true } : i));
    case "add":
      return [...state, action.item];
    case "remove":
      return state.filter((i) => i.id !== action.id);
  }
}

// `formId` switches this from saving each change straight away to holding
// them until the details form is saved. Nothing on the Details tab should
// write to the database while the certifier is still working through the
// page — the list travels with the form as hidden fields instead.
export function CriticalStageInspections({ jobId, items, formId }: { jobId: string; items: CriticalStageInspection[]; formId?: string }) {
  const initial = normalizeCriticalStageInspections(items);
  const [draft, setDraft] = useState<CriticalStageInspection[]>(initial);
  const [list, dispatch] = useOptimistic(formId ? draft : initial, reducer);
  const [, startTransition] = useTransition();

  // In draft mode every change goes through the same reducer, so the two
  // modes can't drift — only where the result is sent differs.
  function apply(action: Action) {
    if (formId) {
      setDraft((prev) => reducer(prev, action));
      return true;
    }
    return false;
  }

  function handleToggle(id: string) {
    if (apply({ type: "toggle", id })) return;
    startTransition(async () => {
      dispatch({ type: "toggle", id });
      const fd = new FormData();
      fd.set("job_id", jobId);
      fd.set("id", id);
      await toggleCriticalStageInspection(fd);
    });
  }

  function handleEdit(id: string, stage: string, inspector: string) {
    if (apply({ type: "edit", id, stage, inspector })) return;
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
    if (apply({ type: "add", item })) return;
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
    if (apply({ type: "remove", id })) return;
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
      {/* Carried into the details form so the list saves when Save
          details is pressed, along with everything else on the page. */}
      {formId && list.map((insp) => <input key={insp.id} type="hidden" form={formId} name="criticalStageInspections" value={JSON.stringify(insp)} />)}
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
        className="rounded-md border border-line bg-hover p-2 space-y-1.5"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) save();
        }}
      >
        <input
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          autoFocus
          placeholder="Stage"
          className="w-full text-sm outline-none bg-white rounded px-2 py-1 border border-line"
        />
        <input
          value={inspector}
          onChange={(e) => setInspector(e.target.value)}
          placeholder="Inspector"
          className="w-full text-xs outline-none bg-white rounded px-2 py-1 border border-line"
        />
        <div className="flex gap-2">
          <button onClick={save} className="text-xs font-semibold text-primary hover:underline">
            Save
          </button>
          <button
            onClick={() => {
              setStage(insp.stage);
              setInspector(insp.inspector);
              setEditing(false);
            }}
            className="text-xs text-placeholder hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 text-sm text-muted">
      <input type="checkbox" checked={insp.enabled} onChange={onToggle} className="mt-0.5 accent-icon shrink-0" />
      {/* Clicking the wording of an inspection that isn't ticked yet
          accepts it — the common case is "yes, this one applies", not
          "let me reword it". Once it's ticked, clicking opens the editor. */}
      <button onClick={() => (insp.enabled ? setEditing(true) : onToggle())} className="flex-1 min-w-0 text-left">
        {index}. {insp.stage} <span className="text-placeholder">({insp.inspector})</span>
      </button>
      {insp.enabled && (
        <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 shrink-0">
          Edit
        </button>
      )}
      <button onClick={onRemove} className="p-0.5 rounded text-placeholder hover:text-error opacity-0 group-hover:opacity-100 shrink-0">
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
      <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-1">
        <Plus size={13} /> Add inspection
      </button>
    );
  }

  return (
    <div className="rounded-md border border-line p-2 space-y-1.5 mt-1">
      <input
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        autoFocus
        placeholder="Stage (e.g. Prior to pouring slab)"
        className="w-full text-sm outline-none bg-white rounded px-2 py-1 border border-line"
      />
      <input
        value={inspector}
        onChange={(e) => setInspector(e.target.value)}
        placeholder="Inspector (e.g. Registered Certifier)"
        className="w-full text-xs outline-none bg-white rounded px-2 py-1 border border-line"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs font-semibold text-primary hover:underline">
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setStage("");
            setInspector("");
          }}
          className="text-xs text-placeholder hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
