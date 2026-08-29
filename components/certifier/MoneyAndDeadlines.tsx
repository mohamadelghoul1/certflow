import Link from "next/link";
import { ComplianceList } from "@/components/certifier/ComplianceList";
import { InvoicesList } from "@/components/certifier/InvoicesList";

// Invoices and deadlines on one screen.
//
// They were two pages asking the same question — what still needs
// chasing — and an overdue invoice appeared on both, so the same fact
// lived in two places in the menu. One page, two tabs: the money ledger
// is a working list you add to, the deadlines are a read-and-go-fix
// list, so they stay side by side rather than interleaved into one
// stream that would be neither.
//
// Both addresses still work and each opens on its own tab, so a link
// kept in an email or a bookmark lands where it always did.

export type MoneyTab = "invoices" | "deadlines";

export function MoneyAndDeadlines({ firmId, tab }: { firmId: string; tab: MoneyTab }) {
  const tabs: { key: MoneyTab; label: string; href: string }[] = [
    { key: "invoices", label: "Invoices", href: "/invoices" },
    { key: "deadlines", label: "Deadlines", href: "/compliance" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-primary mb-4">Invoices &amp; compliance</h1>

      <div className="flex items-center gap-1 border-b border-line mb-6">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              t.key === tab ? "border-primary text-primary" : "border-transparent text-muted hover:text-primary"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "invoices" ? <InvoicesList firmId={firmId} /> : <ComplianceList firmId={firmId} />}
    </div>
  );
}
