"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2 } from "lucide-react";

type TabMeta = {
  key: string;
  label: string;
  progress?: string | null;
  // Nothing left to do at this stage: the certificate is issued, the
  // checklist is fully approved, every inspection has been carried out,
  // the occupation certificate exists. Green, the same cue an approved
  // checklist item gets.
  complete?: boolean;
};

// Lets a panel move the user to a different tab — e.g. saving the job
// details jumps straight to the CDC/CC tab, which is where the work
// actually continues. Defaults to a no-op so a panel rendered outside
// JobTabs (in a test, or on its own page) still works.
const SelectTabContext = createContext<(key: string) => void>(() => {});

export function useSelectTab() {
  return useContext(SelectTabContext);
}

// All five tabs' content is already fetched and rendered up front (the
// data queries on the job page were never actually scoped to one tab), so
// switching tabs here is just toggling which already-rendered panel is
// visible — no navigation, no server round trip, no wait.
export function JobTabs({ tabs, initialTab, content }: { tabs: TabMeta[]; initialTab: string; content: Record<string, React.ReactNode> }) {
  const [active, setActive] = useState(initialTab);

  // Stable identity: this function is the context value, so recreating it
  // on every render made every consumer re-render, and any effect that
  // depends on it re-run — which is what made the jump-to-CDC after
  // saving fire over and over instead of once.
  const select = useCallback((key: string) => {
    setActive(key);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${key}`);
  }, []);

  return (
    <SelectTabContext.Provider value={select}>
      <div className="mb-8 overflow-x-auto">
        <div className="inline-flex gap-1 bg-surface rounded-full p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => select(t.key)}
              // A finished stage reads as done at a glance: the tab you
              // are on fills solid, the rest sit in the same soft green an
              // approved checklist item gets, so the strip shows what is
              // left without becoming a wall of colour.
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all inline-flex items-center gap-1.5 ${
                active === t.key
                  ? t.complete
                    ? "bg-accent text-white shadow-sm"
                    : "bg-white text-heading shadow-sm"
                  : t.complete
                  ? "bg-success-bg text-accent border border-accent/30"
                  : "text-muted hover:text-heading"
              }`}
            >
              {t.complete && <CheckCircle2 size={13} />}
              {t.label}
              {t.progress && <span className="text-xs font-normal opacity-70">{t.progress}</span>}
            </button>
          ))}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={active !== t.key}>
          {content[t.key]}
        </div>
      ))}
    </SelectTabContext.Provider>
  );
}
