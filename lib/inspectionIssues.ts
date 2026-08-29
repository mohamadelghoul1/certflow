// Whether an inspection has an issues section, and what it is called.
//
// The three outcomes mean different things, and one heading for all of
// them was wrong twice over. A passed inspection has nothing to record —
// offering an empty "Issues to record" box invites something to be typed
// into it that then contradicts the outcome on the certificate. And what
// a satisfactory inspection is waiting on is not a defect: it is a
// document the builder still owes, which is what the report has always
// called it.
//
// The certifier's card, the on-site screen and anything else that lists
// them all read this, so they cannot drift apart.

export type IssuesSection = { show: boolean; title: string; placeholder: string; addLabel: string; hint?: string };

export function issuesSection(outcome: string, hasIssues = false): IssuesSection {
  if (outcome === "failed") {
    return { show: true, title: "Issues to record", placeholder: "What needs fixing? One item at a time.", addLabel: "Add issue" };
  }

  if (outcome === "passed_subject_to") {
    return { show: true, title: "Items to be provided", placeholder: "What is still to be provided? One item at a time.", addLabel: "Add item" };
  }

  if (outcome === "passed") {
    // Nothing to record on a pass — but anything already recorded stays
    // on screen rather than vanishing. An issue typed before the outcome
    // was changed is still in the record and still prints on the report,
    // so hiding it would be the certifier signing something they can no
    // longer see.
    return {
      show: hasIssues,
      title: "Issues recorded",
      placeholder: "What needs fixing? One item at a time.",
      addLabel: "Add issue",
      hint: "A passed inspection normally has none. Clear these, or change the outcome above.",
    };
  }

  // Nothing chosen yet. The section stays as it was, so a certifier who
  // starts typing before tapping an outcome is not stopped.
  return { show: true, title: "Issues to record", placeholder: "What needs fixing? One item at a time.", addLabel: "Add issue" };
}
