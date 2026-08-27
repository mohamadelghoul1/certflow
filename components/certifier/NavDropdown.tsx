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
  extraLinks = [],
}: {
  label: string;
  items: Item[];
  viewAllHref: string;
  viewAllLabel: string;
  createHref: string;
  createLabel: string;
  itemHrefBase: string;
  itemHrefSuffix?: string;
  // Ready-made filtered views, listed under "view all".
  extraLinks?: { href: string; label: string }[];
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
        // Dressed exactly like NavLink, so the menu reads as one row of
        // equals rather than two kinds of item.
        className={`flex items-center gap-1 py-4 px-3 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 ${
          open ? "text-white border-icon" : "text-white/80 border-transparent hover:text-white hover:border-icon"
        }`}
      >
        {label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-50 w-72 bg-white rounded-b-lg shadow-xl border border-line overflow-hidden"
          >
            <Link
              href={createHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-secondary hover:bg-hover border-b border-line"
            >
              <Plus size={14} /> {createLabel}
            </Link>
            {items.length > 0 && (
              <div className="max-h-72 overflow-y-auto">
                {items.map((it) => (
                  <Link key={it.id} href={`${itemHrefBase}/${it.id}${itemHrefSuffix}`} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-hover border-b border-line last:border-b-0">
                    <div className="font-medium text-heading truncate">{it.title}</div>
                    {it.subtitle && <div className="text-xs text-placeholder truncate">{it.subtitle}</div>}
                  </Link>
                ))}
              </div>
            )}
            {items.length === 0 && <div className="px-4 py-3 text-xs text-placeholder">Nothing yet.</div>}
            <Link href={viewAllHref} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-secondary hover:bg-hover border-t border-line">
              {viewAllLabel} →
            </Link>
            {extraLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-muted hover:bg-hover hover:text-primary border-t border-line">
                {link.label}
              </Link>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
