"use client";

import { useState } from "react";

type TabMeta = { key: string; label: string; progress?: string | null };

// All five tabs' content is already fetched and rendered up front (the
// data queries on the job page were never actually scoped to one tab), so
// switching tabs here is just toggling which already-rendered panel is
// visible — no navigation, no server round trip, no wait.
export function JobTabs({ tabs, initialTab, content }: { tabs: TabMeta[]; initialTab: string; content: Record<string, React.ReactNode> }) {
  const [active, setActive] = useState(initialTab);

  function select(key: string) {
    setActive(key);
    const url = `${window.location.pathname}?tab=${key}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      <div className="mb-8 overflow-x-auto">
        <div className="inline-flex gap-1 bg-slate-100 rounded-full p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => select(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                active === t.key ? "bg-white text-heading shadow-sm" : "text-muted hover:text-heading"
              }`}
            >
              {t.label}
              {t.progress && <span className="ml-1.5 text-xs font-normal opacity-70">{t.progress}</span>}
            </button>
          ))}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={active !== t.key}>
          {content[t.key]}
        </div>
      ))}
    </div>
  );
}
