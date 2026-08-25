import { Check, X } from "lucide-react";
import type { SystemCheck, EnvCheck } from "@/lib/systemCheck";

// Reads as a list of things that either work or do not, with the reason
// they matter beside each. The point is that a feature which silently
// does nothing — because a database update was never run, or a key was
// never set — says so here rather than looking like a fault in the app.
function Row({ ok, label, detail, note }: { ok: boolean; label: string; detail: string; note?: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3 border-b border-line last:border-b-0">
      <span className={`mt-0.5 shrink-0 rounded-full p-1 ${ok ? "bg-success-bg text-accent" : "bg-warning-bg text-warning-text"}`}>
        {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-primary">
          {label}
          {note && <span className="ml-2 font-normal text-xs text-placeholder">{note}</span>}
        </div>
        <div className="text-xs text-placeholder">{detail}</div>
      </div>
    </div>
  );
}

export function SystemCheckSection({ checks, env }: { checks: SystemCheck[]; env: EnvCheck[] }) {
  const missing = checks.filter((c) => !c.applied);
  const outstanding = Array.from(new Set(missing.map((c) => c.migration))).sort();

  return (
    <div className="space-y-5">
      {outstanding.length > 0 ? (
        <div className="rounded-md border border-warning/50 bg-warning-bg px-4 py-3 text-sm text-warning-text">
          <span className="font-semibold">
            {outstanding.length === 1 ? "One database update has not been run yet" : `${outstanding.length} database updates have not been run yet`}:
          </span>{" "}
          {outstanding.map((m) => `${m}`).join(", ")}. Open the matching file in <span className="font-mono text-xs">supabase/migrations/</span> and run it in the Supabase SQL editor. Until
          then the features below marked with a cross do nothing.
        </div>
      ) : (
        <div className="rounded-md border border-success/40 bg-success-bg px-4 py-3 text-sm text-accent">Every database update has been run against this database.</div>
      )}

      <div className="rounded-lg border border-line overflow-hidden">
        {checks.map((c, i) => (
          <Row key={i} ok={c.applied} label={c.label} detail={c.detail} note={`migration ${c.migration}`} />
        ))}
      </div>

      <div>
        <div className="text-xs font-semibold text-placeholder uppercase tracking-wide mb-2">Settings held in Vercel</div>
        <div className="rounded-lg border border-line overflow-hidden">
          {env.map((e, i) => (
            <Row key={i} ok={e.configured} label={e.label} detail={e.detail} note={e.configured ? "set" : "not set"} />
          ))}
        </div>
      </div>
    </div>
  );
}
