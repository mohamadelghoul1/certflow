"use client";

import { Stamp } from "lucide-react";

// Purely presentational: the optimistic value and the toggle action live
// in ItemStatusActions, one level up. They used to live here — which made
// this button flip instantly while "Preview stamp" and "Position stamp",
// gated on the server-confirmed value next door, lagged a whole round
// trip behind it. One shared optimistic value moves all three together.
export function StampToggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-full border ${
        value ? "bg-warning-bg border-warning/50 text-warning-text" : "border-line text-muted hover:bg-hover"
      }`}
      onClick={onToggle}
    >
      <Stamp size={13} /> {value ? "Stamp required" : "Stamp not required"}
    </button>
  );
}
