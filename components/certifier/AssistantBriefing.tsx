"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw } from "lucide-react";
import { loadBriefing, type BriefingView } from "@/lib/actions/briefing";

// The assistant's note at the top of the dashboard.
//
// Fetched after the page has drawn rather than with it: the first note
// of the day is written by the AI and takes a few seconds, and a
// dashboard that waited for it would feel broken every morning. Until
// it arrives the card says what it is doing.

export function AssistantBriefing() {
  const [briefing, setBriefing] = useState<BriefingView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function fetchBriefing(force: boolean) {
    startTransition(async () => {
      try {
        const next = await loadBriefing(force);
        setBriefing(next);
        setFailed(null);
      } catch (e) {
        setFailed(e instanceof Error ? e.message : "The note could not be written.");
      }
    });
  }

  useEffect(() => {
    fetchBriefing(false);
    // Once, when the dashboard opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const writtenAt = briefing?.generatedAt
    ? new Date(briefing.generatedAt).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="mt-6 rounded-xl border border-line bg-white shadow-sm px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={15} className="text-icon" />
        <span className="text-sm font-semibold text-heading">Your assistant</span>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-placeholder">
          {briefing && (
            <span>
              {briefing.written === "ai" ? "Written by AI" : "From the facts"}
              {writtenAt ? ` · ${writtenAt}` : ""}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchBriefing(true)}
            disabled={pending}
            className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline disabled:opacity-50"
          >
            <RefreshCw size={11} className={pending ? "animate-spin" : ""} /> Refresh
          </button>
        </span>
      </div>

      {!briefing && !failed && <p className="text-sm text-muted">{pending ? "Reading through your projects…" : "Loading…"}</p>}
      {failed && <p className="text-sm text-error">{failed}</p>}

      {briefing && (
        <>
          <p className="text-sm text-heading font-medium">{briefing.headline}</p>
          {briefing.points.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {briefing.points.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-heading leading-snug">
                  <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-icon shrink-0" />
                  <span>
                    {point.text}
                    {point.jobId && (
                      <Link href={`/jobs/${point.jobId}`} className="ml-1.5 text-xs font-semibold text-secondary hover:underline whitespace-nowrap">
                        Open →
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {briefing.changedSince && (
            <p className="mt-2 text-xs text-warning-text">Things have moved since this was written — press Refresh for the latest.</p>
          )}
          {briefing.error && <p className="mt-2 text-xs text-error">{briefing.error}</p>}
          {briefing.setupNeeded && <p className="mt-2 text-xs text-placeholder">{briefing.setupNeeded}</p>}
        </>
      )}
    </div>
  );
}
