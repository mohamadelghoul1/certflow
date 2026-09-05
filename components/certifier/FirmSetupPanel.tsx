"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, CircleAlert } from "lucide-react";
import { setupProgress, nextStep, type SetupStep } from "@/lib/firmSetup";

// The first thing a new firm sees, and the last thing they see of it.
//
// Open by default while anything essential is missing, because a
// certificate issued without a logo or a registration number is wrong
// on its face. Once the essentials are done it collapses to one line,
// and once everything is done the dashboard stops rendering it at all.
export function FirmSetupPanel({ steps }: { steps: SetupStep[] }) {
  const progress = setupProgress(steps);
  const [open, setOpen] = useState(progress.essentialLeft > 0);
  const next = nextStep(steps);
  if (progress.complete) return null;

  return (
    <section className="rounded-xl border border-warning/50 bg-warning-bg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-warning/10"
      >
        {open ? <ChevronDown size={16} className="shrink-0 text-warning-text" /> : <ChevronRight size={16} className="shrink-0 text-warning-text" />}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-warning-text">Finish setting up your firm</span>
          <span className="block text-xs text-warning-text/80 truncate">
            {open || !next ? `${progress.done} of ${progress.total} done` : `Next: ${next.label}`}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-warning-text tabular-nums">
          {progress.done}/{progress.total}
        </span>
      </button>

      {open && (
        <ul className="border-t border-warning/30 divide-y divide-warning/20">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-3 px-5 py-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  step.done ? "bg-success text-white" : step.essential ? "bg-warning/25 text-warning-text" : "bg-white/60 text-placeholder"
                }`}
              >
                {step.done ? <Check size={12} strokeWidth={3} /> : step.essential ? <CircleAlert size={12} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${step.done ? "text-warning-text/60 line-through" : "text-warning-text"}`}>
                  {step.label}
                </span>
                {!step.done && <span className="block text-xs text-warning-text/80 mt-0.5">{step.why}</span>}
              </span>
              {!step.done && (
                <Link href={step.href} className="shrink-0 text-xs font-semibold text-warning-text hover:underline whitespace-nowrap mt-0.5">
                  Do this →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
