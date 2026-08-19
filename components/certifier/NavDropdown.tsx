"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";

type Item = { id: string; title: string; subtitle: string };

export function NavDropdown({
  label,
  items,
  viewAllHref,
  viewAllLabel,
  createHref,
  createLabel,
  itemHref,
}: {
  label: string;
  items: Item[];
  viewAllHref: string;
  viewAllLabel: string;
  createHref: string;
  createLabel: string;
  itemHref: (id: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 py-4 px-3 text-sm font-semibold whitespace-nowrap ${open ? "text-amber-300" : "text-slate-200 hover:text-amber-300"}`}
      >
        {label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 w-72 bg-white rounded-b-lg shadow-xl border border-slate-200 border-t-0 overflow-hidden">
          <Link
            href={createHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-slate-50 border-b border-slate-100"
          >
            <Plus size={14} /> {createLabel}
          </Link>
          {items.length > 0 && (
            <div className="max-h-72 overflow-y-auto">
              {items.map((it) => (
                <Link key={it.id} href={itemHref(it.id)} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-b-0">
                  <div className="font-medium text-slate-800 truncate">{it.title}</div>
                  {it.subtitle && <div className="text-xs text-slate-400 truncate">{it.subtitle}</div>}
                </Link>
              ))}
            </div>
          )}
          {items.length === 0 && <div className="px-4 py-3 text-xs text-slate-400">Nothing yet.</div>}
          <Link href={viewAllHref} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-slate-50 border-t border-slate-100">
            {viewAllLabel} →
          </Link>
        </div>
      )}
    </div>
  );
}
