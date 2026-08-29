"use client";

import { issuesSection } from "@/lib/inspectionIssues";
import { useSiteOutcome } from "@/components/site/SiteOutcome";

// The numbered steps of an inspection, numbered by what is actually on
// screen.
//
// A passed inspection has no issues to record, so that step is not
// there — and if the numbers were fixed in the markup the screen would
// read 1, 3, 4, 5 with a hole where the missing step used to be. So the
// steps are given in order and numbered as they are rendered.

export type SiteStep = {
  key: string;
  title: string;
  node: React.ReactNode;
};

export function SiteSteps({ steps, issues, hasIssues }: { steps: SiteStep[]; issues: React.ReactNode; hasIssues: boolean }) {
  const { outcome } = useSiteOutcome();
  const section = issuesSection(outcome, hasIssues);

  const shown: SiteStep[] = [];
  for (const step of steps) {
    shown.push(step);
    // The issues step sits directly after the outcome, where it can be
    // seen the moment the outcome is chosen.
    if (step.key === "outcome" && section.show) {
      shown.push({
        key: "issues",
        title: section.title,
        node: (
          <>
            {section.hint && <p className="text-xs text-warning-text bg-warning-bg rounded-md px-3 py-2 mb-3">{section.hint}</p>}
            {issues}
          </>
        ),
      });
    }
  }

  return (
    <>
      {shown.map((step, index) => (
        <section key={step.key} className="bg-white border border-line rounded-xl p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-heading mb-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs">{index + 1}</span>
            {step.title}
          </h2>
          {step.node}
        </section>
      ))}
    </>
  );
}
