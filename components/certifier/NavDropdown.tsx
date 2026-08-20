"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  itemHrefBase,
  itemHrefSuffix = "",
}: {
  label: string;
  items: Item[];
  viewAllHref: string;
  viewAllLabel: string;
  createHref: string;
  createLabel: string;
  itemHrefBase: string;
  itemHrefSuffix?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function toggleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom, left: rect.left });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className={`flex items-center gap-1 py-4 px-3 text-sm font-semibold whitespace-nowrap shrink-0 ${open ? "text-amber-300" : "text-slate-200 hover:text-amber-300"}`}
      >
        {label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-50 w-72 bg-white rounded-b-lg shadow-xl border border-slate-200 overflow-hidden"
          >
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
                  <Link key={it.id} href={`${itemHrefBase}/${it.id}${itemHrefSuffix}`} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-b-0">
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
          </div>,
          document.body
        )}
    </>
  );
}
