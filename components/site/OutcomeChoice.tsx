"use client";

import { Check, AlertTriangle, X } from "lucide-react";
import { useSiteOutcome } from "@/components/site/SiteOutcome";

// What was found, in three taps' worth of screen.
//
// The first thing done on site and the thing everything else hangs off,
// so it is the first thing on the page and the buttons are the size of a
// thumb. Recording it stamps today's date on the inspection if it had
// none, which is what makes an unbooked visit still land in the record.
const CHOICES = [
  { value: "passed", label: "Passed", icon: Check, tone: "border-success bg-success-bg text-success", active: "bg-success border-success text-white" },
  {
    value: "passed_subject_to",
    label: "Satisfactory — minor issues",
    icon: AlertTriangle,
    tone: "border-warning bg-warning-bg text-warning-text",
    active: "bg-warning-text border-warning-text text-white",
  },
  { value: "failed", label: "Failed", icon: X, tone: "border-error bg-error-bg text-error", active: "bg-error border-error text-white" },
];

export function OutcomeChoice() {
  // The tap lands on the button instantly; the save travels behind it.
  // Held above this component because the issues section below reads it
  // too — see SiteOutcome.
  const { outcome: shown, choose } = useSiteOutcome();

  return (
    <div className="space-y-2">
      {CHOICES.map(({ value, label, icon: Icon, tone, active }) => {
        const chosen = shown === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={chosen}
            className={`w-full flex items-center gap-3 border-2 rounded-xl px-4 py-4 text-left font-semibold transition-colors ${chosen ? active : tone}`}
          >
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${chosen ? "bg-white/25" : "bg-white"}`}>
              <Icon size={16} strokeWidth={2.6} />
            </span>
            <span className="leading-snug">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
