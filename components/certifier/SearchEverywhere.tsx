"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type Hit = { label: string; sub: string; href: string };
type Group = { group: string; hits: Hit[] };

// One box over everything: press the icon (or Ctrl+K) and type an
// address, a client, a CDC number, an invoice number — the answers come
// grouped, and choosing one goes straight there.
export function SearchEverywhere() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Closing also forgets: reopening starts from an empty box, done in
  // the handlers rather than an effect so no render cascades.
  function close() {
    setOpen(false);
    setQuery("");
    setGroups([]);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // close is stable in behaviour; re-binding per render is harmless.
  });

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Debounced: the request goes when the typing pauses, and a stale
  // answer arriving late is ignored rather than overwriting a newer one.
  useEffect(() => {
    if (query.trim().length < 2) return;
    let stale = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const body = (await res.json()) as { results: Group[] };
        if (!stale) setGroups(body.results || []);
      } catch {
        if (!stale) setGroups([]);
      } finally {
        if (!stale) setBusy(false);
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search everything (Ctrl+K)"
        title="Search everything (Ctrl+K)"
        className="p-2 rounded-md text-placeholder hover:text-white hover:bg-white/10"
      >
        <Search size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[12vh] px-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
              <Search size={16} className="text-placeholder shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value.trim().length < 2) setGroups([]);
                }}
                placeholder="Search projects, clients, quotes, invoices…"
                className="flex-1 text-sm outline-none"
              />
              <kbd className="text-[10px] text-placeholder border border-line rounded px-1.5 py-0.5">Esc</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {groups.map((group) => (
                <div key={group.group}>
                  <div className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-placeholder">{group.group}</div>
                  {group.hits.map((hit) => (
                    <button
                      key={hit.href + hit.label}
                      onClick={() => {
                        close();
                        router.push(hit.href);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-hover"
                    >
                      <div className="text-sm font-medium text-primary truncate">{hit.label}</div>
                      {hit.sub && <div className="text-xs text-placeholder truncate">{hit.sub}</div>}
                    </button>
                  ))}
                </div>
              ))}
              {query.trim().length >= 2 && !busy && groups.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-placeholder">Nothing matches &ldquo;{query.trim()}&rdquo;.</div>
              )}
              {query.trim().length < 2 && (
                <div className="px-4 py-6 text-center text-xs text-placeholder">Type an address, a client, a certificate number, an invoice…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
