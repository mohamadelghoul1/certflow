"use client";

import { useOptimistic, useState, useTransition } from "react";
import { createTaskList, renameTaskList, deleteTaskList, addTask, toggleTaskComplete, updateTaskText, deleteTask } from "@/lib/actions/tasks";
import { Plus, X, Trash2, GripVertical } from "lucide-react";
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
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex gap-4 min-w-max px-1">
        {lists.map((l) => (
          <TaskListColumn key={l.id} list={l} />
        ))}
        <NewListColumn />
      </div>
    </div>
  );
}

function TaskListColumn({ list }: { list: ListWithTasks }) {
  const [title, setTitle] = useState(list.title);
  const [, startTransition] = useTransition();
  const [tasks, dispatch] = useOptimistic(list.tasks, tasksReducer);
  const incomplete = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === list.title) {
      setTitle(list.title);
      return;
    }
    const fd = new FormData();
    fd.set("list_id", list.id);
    fd.set("title", trimmed);
    renameTaskList(fd);
  }

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
    <div className="w-72 shrink-0 bg-white rounded-lg border border-slate-200 flex flex-col max-h-[70vh]">
      <div className="flex items-center gap-1 px-3 py-2.5 border-b border-slate-100">
        <GripVertical size={13} className="text-slate-300 shrink-0" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          className="flex-1 min-w-0 text-sm font-semibold text-teal-900 outline-none bg-transparent rounded px-1 -mx-1 focus:bg-slate-50"
        />
        <button
          onClick={() => {
            if (confirm(`Delete "${list.title}" and all ${list.tasks.length} task${list.tasks.length === 1 ? "" : "s"} in it? This can't be undone.`)) {
              const fd = new FormData();
              fd.set("list_id", list.id);
              deleteTaskList(fd);
            }
          }}
          className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0"
        >
          <Trash2 size={13} />
        </button>
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
        <details className="border-t border-slate-100 px-3 py-2">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">Completed ({completed.length})</summary>
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
      className="flex items-center gap-1.5 text-sm text-slate-500"
    >
      <button type="submit" aria-label="Add task" className="shrink-0 text-teal-700 hover:text-teal-900 p-0.5 -m-0.5">
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
      <div className="rounded-md border border-teal-200 bg-teal-50/40 px-2 py-1.5 space-y-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="w-full text-sm outline-none bg-white rounded px-2 py-1 border border-slate-200"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full text-xs outline-none bg-white rounded px-2 py-1 border border-slate-200 placeholder-slate-400"
        />
        <div className="flex gap-2">
          <button onClick={save} className="text-xs font-semibold text-teal-800 hover:underline">
            Save
          </button>
          <button
            onClick={() => {
              setText(task.text);
              setNote(task.note || "");
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
    <div className="group flex items-start gap-2 px-1 py-1.5 rounded-md hover:bg-slate-50">
      <input type="checkbox" checked={task.completed} onChange={onToggle} className="mt-0.5 accent-teal-700 shrink-0" />
      <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left">
        <div className={`text-sm ${task.completed ? "text-slate-400 line-through" : "text-slate-700"}`}>{task.text}</div>
        {task.note && <div className="text-xs text-slate-400 truncate">{task.note}</div>}
        {task.completed && task.completed_at && (
          <div className="text-[11px] text-emerald-600 mt-0.5">
            Completed {formatCompletedAt(task.completed_at)} · took {formatDuration(task.created_at, task.completed_at)}
          </div>
        )}
      </button>
      <button onClick={onDelete} className="p-0.5 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0">
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
        className="w-72 shrink-0 h-11 flex items-center gap-1.5 px-3 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:text-teal-800 hover:border-teal-300"
      >
        <Plus size={14} /> Create new list
      </button>
    );
  }

  return (
    <div className="w-72 shrink-0 bg-white rounded-lg border border-slate-200 p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="List name"
        autoFocus
        className="w-full text-sm outline-none bg-white rounded px-2 py-1.5 border border-slate-200 mb-2"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 px-3 py-1.5 rounded-md">
          Create list
        </button>
        <button
          onClick={() => {
            setTitle("");
            setAdding(false);
          }}
          className="text-xs text-slate-400 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
