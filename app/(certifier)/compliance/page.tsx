import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getComplianceItems, type ComplianceItem } from "@/lib/compliance";
import { todayISO, formatISODate, daysUntil } from "@/lib/business";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarDays, ShieldCheck } from "lucide-react";

// Every deadline the firm is standing under, on one screen, worst
// first. The rows come from lib/compliance — each links straight to the
// place it gets fixed.
export default async function CompliancePage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const items = await getComplianceItems(supabase, profile.firm_id, todayISO());

  const groups: { key: ComplianceItem["severity"]; label: string; icon: typeof AlertTriangle; tone: string }[] = [
    { key: "overdue", label: "Overdue", icon: AlertTriangle, tone: "text-error" },
    { key: "soon", label: "Due within 7 days", icon: CalendarClock, tone: "text-warning-text" },
    { key: "upcoming", label: "Coming up", icon: CalendarDays, tone: "text-icon" },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-primary mb-1">Compliance</h1>
      <p className="text-sm text-muted mb-6">
        Registrations and insurance, overdue invoices and approaching lapse dates — everything with a date attached, worst first.
      </p>

      {items.length === 0 && (
        <div className="rounded-xl border border-line bg-white p-8 text-center">
          <ShieldCheck size={28} className="mx-auto text-accent mb-2" />
          <div className="text-sm font-semibold text-heading">Nothing is overdue and nothing is looming.</div>
          <div className="text-xs text-muted mt-1">New deadlines appear here the moment they start ticking.</div>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((group) => {
          const rows = items.filter((i) => i.severity === group.key);
          if (rows.length === 0) return null;
          const Icon = group.icon;
          return (
            <div key={group.key}>
              <div className={`flex items-center gap-2 mb-2 text-sm font-bold ${group.tone}`}>
                <Icon size={15} /> {group.label} ({rows.length})
              </div>
              <div className={`rounded-lg border bg-white overflow-hidden ${group.key === "overdue" ? "border-error/40" : "border-line"}`}>
                {rows.map((item, i) => {
                  const days = daysUntil(item.dueDate);
                  return (
                    <Link key={i} href={item.href} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line last:border-b-0 hover:bg-hover">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-primary">{item.title}</div>
                        {item.detail && <div className="text-xs text-placeholder truncate">{item.detail}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs font-semibold ${group.key === "overdue" ? "text-error" : "text-heading"}`}>{formatISODate(item.dueDate)}</div>
                        {days !== null && (
                          <div className="text-[11px] text-placeholder">
                            {days < 0 ? `${-days} day${days === -1 ? "" : "s"} overdue` : days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
