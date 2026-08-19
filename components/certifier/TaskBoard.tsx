"use client";

import { useState } from "react";
import { createTaskList, renameTaskList, deleteTaskList, addTask, toggleTaskComplete, updateTaskText, deleteTask } from "@/lib/actions/tasks";
import { Plus, X, Trash2, GripVertical } from "lucide-react";
import type { TaskList, ManualTask } from "@/types/db";

type ListWithTasks = TaskList & { tasks: ManualTask[] };

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
  const incomplete = list.tasks.filter((t) => !t.completed);
  const completed = list.tasks.filter((t) => t.completed);

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
        <AddTaskForm listId={list.id} />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {incomplete.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>

      {completed.length > 0 && (
        <details className="border-t border-slate-100 px-3 py-2">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">Completed ({completed.length})</summary>
          <div className="mt-1.5 space-y-0.5">
            {completed.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function AddTaskForm({ listId }: { listId: string }) {
  const [text, setText] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("list_id", listId);
    fd.set("text", trimmed);
    addTask(fd);
    setText("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 text-sm text-slate-500">
      <button type="submit" aria-label="Add task" className="shrink-0 text-teal-700 hover:text-teal-900 p-0.5 -m-0.5">
        <Plus size={14} />
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a task"
        className="flex-1 min-w-0 outline-none bg-transparent placeholder-slate-400 py-1"
      />
    </form>
  );
}

function TaskRow({ task }: { task: ManualTask }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(task.text);
  const [note, setNote] = useState(task.note || "");

  function toggle() {
    const fd = new FormData();
    fd.set("task_id", task.id);
    fd.set("completed", (!task.completed).toString());
    toggleTaskComplete(fd);
  }

  function save() {
    const trimmed = text.trim();
    if (!trimmed) {
      setText(task.text);
      setEditing(false);
      return;
    }
    const fd = new FormData();
    fd.set("task_id", task.id);
    fd.set("text", trimmed);
    fd.set("note", note.trim());
    updateTaskText(fd);
    setEditing(false);
  }

  function remove() {
    const fd = new FormData();
    fd.set("task_id", task.id);
    deleteTask(fd);
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
      <input type="checkbox" checked={task.completed} onChange={toggle} className="mt-0.5 accent-teal-700 shrink-0" />
      <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left">
        <div className={`text-sm ${task.completed ? "text-slate-400 line-through" : "text-slate-700"}`}>{task.text}</div>
        {task.note && <div className="text-xs text-slate-400 truncate">{task.note}</div>}
      </button>
      <button onClick={remove} className="p-0.5 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0">
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
