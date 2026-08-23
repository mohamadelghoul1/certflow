"use client";

import { useOptimistic, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { createTaskList, deleteTaskList, moveTaskList, addTask, toggleTaskComplete, updateTaskText, deleteTask } from "@/lib/actions/tasks";
import { Plus, X, Trash2, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import type { TaskList, ManualTask } from "@/types/db";

type ListWithTasks = TaskList & { tasks: ManualTask[] };

type TaskAction =
  | { type: "add"; task: ManualTask }
  | { type: "toggle"; id: string; completed: boolean; completedAt: string | null }
  | { type: "edit"; id: string; text: string; note: string | null }
  | { type: "remove"; id: string };

function tasksReducer(state: ManualTask[], action: TaskAction): ManualTask[] {
  switch (action.type) {
    case "add":
      return [...state, action.task];
    case "toggle":
      return state.map((t) => (t.id === action.id ? { ...t, completed: action.completed, completed_at: action.completedAt } : t));
    case "edit":
      return state.map((t) => (t.id === action.id ? { ...t, text: action.text, note: action.note } : t));
    case "remove":
      return state.filter((t) => t.id !== action.id);
  }
}

function moveReducer(state: ListWithTasks[], action: { id: string; direction: "left" | "right" }): ListWithTasks[] {
  const idx = state.findIndex((l) => l.id === action.id);
  const swapIdx = action.direction === "left" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= state.length) return state;
  const next = [...state];
  [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
  return next;
}

function formatCompletedAt(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDuration(startIso: string, endIso: string) {
  const ms = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function TaskBoard({ lists }: { lists: ListWithTasks[] }) {
  const [order, dispatchOrder] = useOptimistic(lists, moveReducer);
  const [, startTransition] = useTransition();

  function handleMove(id: string, direction: "left" | "right") {
    startTransition(async () => {
      dispatchOrder({ id, direction });
      const fd = new FormData();
      fd.set("list_id", id);
      fd.set("direction", direction);
      await moveTaskList(fd);
    });
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto pb-2">
      <div className="flex gap-4 min-w-max px-1">
        {order.map((l, i) => (
          <TaskListColumn
            key={l.id}
            list={l}
            canMoveLeft={i > 0}
            canMoveRight={i < order.length - 1}
            onMove={(direction) => handleMove(l.id, direction)}
          />
        ))}
        <NewListColumn />
      </div>
    </div>
  );
}

function TaskListColumn({
  list,
  canMoveLeft,
  canMoveRight,
  onMove,
}: {
  list: ListWithTasks;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMove: (direction: "left" | "right") => void;
}) {
  const [, startTransition] = useTransition();
  const [tasks, dispatch] = useOptimistic(list.tasks, tasksReducer);
  const [menuOpen, setMenuOpen] = useState(false);
  const incomplete = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  function handleAdd(text: string) {
    const task: ManualTask = {
      id: `temp-${Math.random().toString(36).slice(2)}`,
      list_id: list.id,
      text,
      note: null,
      completed: false,
      completed_at: null,
      sort_order: tasks.length,
      created_at: new Date().toISOString(),
    };
    startTransition(async () => {
      dispatch({ type: "add", task });
      const fd = new FormData();
      fd.set("list_id", list.id);
      fd.set("text", text);
      await addTask(fd);
    });
  }

  function handleToggle(task: ManualTask) {
    const completed = !task.completed;
    const completedAt = completed ? new Date().toISOString() : null;
    startTransition(async () => {
      dispatch({ type: "toggle", id: task.id, completed, completedAt });
      const fd = new FormData();
      fd.set("task_id", task.id);
      fd.set("completed", completed.toString());
      await toggleTaskComplete(fd);
    });
  }

  function handleEdit(task: ManualTask, text: string, note: string) {
    startTransition(async () => {
      dispatch({ type: "edit", id: task.id, text, note: note || null });
      const fd = new FormData();
      fd.set("task_id", task.id);
      fd.set("text", text);
      fd.set("note", note);
      await updateTaskText(fd);
    });
  }

  function handleDelete(task: ManualTask) {
    startTransition(async () => {
      dispatch({ type: "remove", id: task.id });
      const fd = new FormData();
      fd.set("task_id", task.id);
      await deleteTask(fd);
    });
  }

  return (
    <div className="card-lift w-72 shrink-0 bg-white rounded-xl border border-line shadow-sm flex flex-col max-h-[70vh]">
      <div className="flex items-center gap-0.5 px-3 py-2.5 border-b border-line">
        <span className="flex-1 min-w-0 text-sm font-semibold text-heading truncate px-1 -mx-1">{list.title}</span>
        <button
          onClick={() => onMove("left")}
          disabled={!canMoveLeft}
          aria-label="Move list left"
          className="p-1 rounded text-placeholder hover:text-secondary hover:bg-info-bg shrink-0 disabled:opacity-0 disabled:pointer-events-none"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => onMove("right")}
          disabled={!canMoveRight}
          aria-label="Move list right"
          className="p-1 rounded text-placeholder hover:text-secondary hover:bg-info-bg shrink-0 disabled:opacity-0 disabled:pointer-events-none"
        >
          <ChevronRight size={14} />
        </button>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="List options"
            className="p-1 rounded text-placeholder hover:text-muted hover:bg-surface"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <>
              {/* Portalled: inside the lifted column, this fixed
                  click-away layer would anchor to the column instead of
                  covering the screen. */}
              {createPortal(<div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />, document.body)}
              <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-white border border-line rounded-md shadow-lg py-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (confirm(`Delete "${list.title}" and all ${list.tasks.length} task${list.tasks.length === 1 ? "" : "s"} in it? This can't be undone.`)) {
                      const fd = new FormData();
                      fd.set("list_id", list.id);
                      deleteTaskList(fd);
                    }
                  }}
                  className="flex items-center gap-1.5 w-full text-left px-3 py-1.5 text-xs text-error hover:bg-error-bg"
                >
                  <Trash2 size={13} /> Delete list
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-3 pt-2 pb-1">
        <AddTaskForm onAdd={handleAdd} />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {incomplete.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={() => handleToggle(t)} onEdit={(text, note) => handleEdit(t, text, note)} onDelete={() => handleDelete(t)} />
        ))}
      </div>

      {completed.length > 0 && (
        <details className="border-t border-line px-3 py-2">
          <summary className="text-xs text-placeholder cursor-pointer hover:text-muted select-none">Completed ({completed.length})</summary>
          <div className="mt-1.5 space-y-0.5">
            {completed.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={() => handleToggle(t)} onEdit={(text, note) => handleEdit(t, text, note)} onDelete={() => handleDelete(t)} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function AddTaskForm({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState("");

  function commit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      className="flex items-center gap-1.5 text-sm text-placeholder"
    >
      <button type="submit" aria-label="Add task" className="shrink-0 text-secondary hover:opacity-80 p-0.5 -m-0.5">
        <Plus size={14} />
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder="Add a task"
        className="flex-1 min-w-0 outline-none bg-transparent placeholder-slate-400 py-1"
      />
    </form>
  );
}

function TaskRow({ task, onToggle, onEdit, onDelete }: { task: ManualTask; onToggle: () => void; onEdit: (text: string, note: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(task.text);
  const [note, setNote] = useState(task.note || "");

  function save() {
    const trimmed = text.trim();
    if (!trimmed) {
      setText(task.text);
      setEditing(false);
      return;
    }
    onEdit(trimmed, note.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <div
        className="rounded-md border border-secondary/40 bg-info-bg/40 px-2 py-1.5 space-y-1.5"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) save();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="w-full text-sm outline-none bg-white rounded px-2 py-1 border border-line"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full text-xs outline-none bg-white rounded px-2 py-1 border border-line placeholder-slate-400"
        />
        <div className="flex gap-2">
          <button onClick={save} className="text-xs font-semibold text-secondary hover:underline">
            Save
          </button>
          <button
            onClick={() => {
              setText(task.text);
              setNote(task.note || "");
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
    <div className="group flex items-start gap-2 px-1 py-1.5 rounded-md hover:bg-hover">
      <input type="checkbox" checked={task.completed} onChange={onToggle} className="mt-0.5 accent-secondary shrink-0" />
      <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left">
        <div className={`text-sm ${task.completed ? "text-placeholder line-through" : "text-muted"}`}>{task.text}</div>
        {task.note && <div className="text-xs text-placeholder truncate">{task.note}</div>}
        {task.completed && task.completed_at && (
          <div className="text-[11px] text-accent mt-0.5">
            Completed {formatCompletedAt(task.completed_at)} · took {formatDuration(task.created_at, task.completed_at)}
          </div>
        )}
      </button>
      <button onClick={onDelete} className="p-0.5 rounded text-placeholder hover:text-error opacity-0 group-hover:opacity-100 shrink-0">
        <X size={13} />
      </button>
    </div>
  );
}

function NewListColumn() {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    const fd = new FormData();
    fd.set("title", trimmed);
    createTaskList(fd);
    setTitle("");
    setAdding(false);
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="w-72 shrink-0 h-11 flex items-center gap-1.5 px-3 rounded-xl border border-dashed border-line text-sm text-muted hover:text-secondary hover:border-secondary/40"
      >
        <Plus size={14} /> Create new list
      </button>
    );
  }

  return (
    <div className="w-72 shrink-0 bg-white rounded-xl border border-line shadow-sm p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="List name"
        autoFocus
        className="w-full text-sm outline-none bg-white rounded px-2 py-1.5 border border-line mb-2"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs font-semibold text-white bg-secondary hover:opacity-90 px-3 py-1.5 rounded-md">
          Create list
        </button>
        <button
          onClick={() => {
            setTitle("");
            setAdding(false);
          }}
          className="text-xs text-placeholder hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
