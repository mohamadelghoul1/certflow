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
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => select(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 ${
              active === t.key ? "border-teal-800 text-teal-900" : "border-transparent text-slate-500 hover:text-teal-800"
            }`}
          >
            {t.label}
            {t.progress && <span className="ml-1 text-xs font-normal text-slate-400">{t.progress}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={active !== t.key}>
          {content[t.key]}
        </div>
      ))}
    </div>
  );
}
