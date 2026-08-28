import { resolveFault } from "@/lib/actions/faults";
import { faultTone, type FaultRow } from "@/lib/faults";
import { AlertTriangle, CheckCircle2, Repeat } from "lucide-react";

// What has gone wrong, and whether anyone has looked at it.
//
// One entry per distinct fault, not per occurrence — a page failing four
// hundred times in a loop is one problem, and four hundred rows would
// bury the other three problems that happened that week.
function when(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const TONE = {
  open: { label: "Open", style: "bg-error-bg text-error", Icon: AlertTriangle },
  repeating: { label: "Happening repeatedly", style: "bg-error-bg text-error", Icon: Repeat },
  handled: { label: "Handled", style: "bg-success-bg text-success", Icon: CheckCircle2 },
};

export function FaultsView({ faults, ready }: { faults: FaultRow[]; ready: boolean }) {
  if (!ready) {
    return (
      <div className="bg-warning-bg border border-warning rounded-lg px-5 py-4 text-sm text-warning-text">
        The fault log needs database update <strong>0047</strong> before it can record anything. Until then, failures are only written to the hosting log.
      </div>
    );
  }

  if (faults.length === 0) {
    return (
      <div className="bg-white border border-line rounded-lg px-5 py-10 text-center">
        <CheckCircle2 size={22} className="mx-auto text-success mb-2" />
        <div className="text-sm font-semibold text-primary">Nothing has failed</div>
        <div className="text-xs text-placeholder mt-1">Every failure — on the server or in someone&rsquo;s browser — lands here on its own.</div>
      </div>
    );
  }

  const open = faults.filter((f) => !f.resolved_at).length;

  return (
    <div>
      <div className="text-xs text-muted mb-3">
        {open === 0 ? "Every fault has been marked handled." : `${open} fault${open === 1 ? "" : "s"} still open.`} You are emailed the first time each
        one happens, not every time.
      </div>

      <div className="space-y-3">
        {faults.map((fault) => {
          const tone = TONE[faultTone(fault)];
          const Icon = tone.Icon;
          return (
            <div key={fault.id} className={`bg-white border rounded-lg p-5 ${fault.resolved_at ? "border-line" : "border-error/40"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${tone.style}`}>
                      <Icon size={12} /> {tone.label}
                    </span>
                    <span className="text-[11px] text-placeholder">
                      {fault.source === "browser" ? "In someone's browser" : "On the server"}
                      {fault.route_type ? ` · ${fault.route_type}` : ""}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-primary mt-1.5 break-words">{fault.message}</div>
                  <div className="text-xs text-muted mt-0.5 break-all">{fault.route || "Page not recorded"}</div>
                  <div className="text-[11px] text-placeholder mt-1">
                    Happened {fault.occurrences} time{fault.occurrences === 1 ? "" : "s"} · last {when(fault.last_seen_at)} · first {when(fault.first_seen_at)}
                    {fault.digest ? ` · reference ${fault.digest}` : ""}
                  </div>
                </div>

                <form action={resolveFault} className="shrink-0">
                  <input type="hidden" name="fault_id" value={fault.id} />
                  <input type="hidden" name="reopen" value={fault.resolved_at ? "true" : "false"} />
                  <button className="px-3 py-1.5 rounded-md border border-line text-xs text-muted font-medium hover:bg-hover">
                    {fault.resolved_at ? "Reopen" : "Mark handled"}
                  </button>
                </form>
              </div>

              {/* The technical detail, out of the way until it is wanted —
                  it is what makes a fault fixable rather than only known. */}
              {fault.stack && (
                <details className="mt-3">
                  <summary className="text-xs text-secondary cursor-pointer hover:underline">Technical detail</summary>
                  <pre className="mt-2 text-[11px] text-muted bg-surface border border-line rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words">{fault.stack}</pre>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
