import type { SupabaseClient } from "@supabase/supabase-js";
import { calcCdcLapseDate, type Pathway } from "@/lib/business";
import type { ChecklistItem } from "@/types/db";

// Every deadline the firm is currently standing under, in one list.
//
// A certifier's real exposure is spread across screens: a registration
// or PI insurance quietly running out, an invoice past its due date, a
// CDC approaching its five-year lapse. Each is visible somewhere; none
// were visible together. This gathers them, dated, sorted by how much
// trouble they'd cause, each row linking to the place it gets fixed.
//
// What is left out matters as much as what is in. A page of deadlines is
// only worth opening if everything on it is really a deadline — one row
// that turns out to be nothing teaches a certifier to skim the rest.

export type ComplianceSeverity = "overdue" | "soon" | "upcoming";

export type ComplianceItem = {
  severity: ComplianceSeverity;
  dueDate: string;
  title: string;
  detail: string;
  href: string;
};

// Overdue is past; "soon" is inside the window that means "this week's
// work"; anything further out is context, not alarm.
export function severityFor(dueIso: string, todayIso: string, soonDays = 7): ComplianceSeverity {
  if (dueIso < todayIso) return "overdue";
  const due = new Date(`${dueIso}T00:00:00Z`).getTime();
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  return due - today <= soonDays * 24 * 60 * 60 * 1000 ? "soon" : "upcoming";
}

type JobRow = {
  id: string;
  address: string;
  pathway: Pathway;
  pathway_approval_date: string | null;
  checklists: { kind: string; checklist_items: Pick<ChecklistItem, "status">[] }[];
  // Only the outcomes, and only because the CDC lapse rule asks whether
  // work has commenced.
  inspections: { outcome: string }[];
};

export async function getComplianceItems(supabase: SupabaseClient, firmId: string, todayIso: string): Promise<ComplianceItem[]> {
  const [{ data: jobs }, { data: certifiers }, { data: invoices }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, address, pathway, pathway_approval_date, checklists(kind, checklist_items(status)), inspections(outcome)"
      )
      .eq("firm_id", firmId)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase.from("certifiers").select("id, name, registration_expiry, pi_insurance_expiry").eq("firm_id", firmId),
    supabase.from("invoices").select("id, invoice_number, reference, due_date, status").eq("firm_id", firmId).eq("status", "sent"),
  ]);

  const items: ComplianceItem[] = [];
  const add = (dueDate: string, title: string, detail: string, href: string) => {
    items.push({ severity: severityFor(dueDate, todayIso), dueDate, title, detail, href });
  };

  // Deliberately not here: the two-business-day Portal reporting clocks,
  // and inspections past their date with no result recorded.
  //
  // Both were noise more often than signal. An inspection is reported
  // from its own card, where the state is plain and the button is; a
  // date that has passed with nothing recorded is usually a booking that
  // moved rather than a duty missed. Repeating them here as red
  // deadlines made a page whose whole worth is that everything on it
  // matters harder to trust. The Portal reporting state still shows on
  // the inspection and the certificate themselves.
  for (const job of (jobs || []) as unknown as JobRow[]) {
    // The five-year CDC lapse, once it is inside the horizon. Only dated
    // lapses appear — a commenced job returns a sentence, not a date.
    const nocItems = job.checklists.find((c) => c.kind === "noc")?.checklist_items || [];
    const lapse = calcCdcLapseDate(job.pathway, job.pathway_approval_date, nocItems, (job.inspections || []).map((i) => i.outcome));
    if (/^\d{4}-\d{2}-\d{2}$/.test(lapse)) {
      const horizon = new Date(`${todayIso}T00:00:00Z`);
      horizon.setUTCDate(horizon.getUTCDate() + 90);
      if (lapse <= horizon.toISOString().slice(0, 10)) {
        add(lapse, "CDC approaching its five-year lapse", `${job.address} — work must have commenced by this date`, `/jobs/${job.id}?tab=pathway`);
      }
    }
  }

  // Accreditation and insurance: the deadlines that outrank every job.
  // Shown from 60 days out — renewals take time.
  const horizon60 = new Date(`${todayIso}T00:00:00Z`);
  horizon60.setUTCDate(horizon60.getUTCDate() + 60);
  const soonEnough = horizon60.toISOString().slice(0, 10);
  for (const c of certifiers || []) {
    if (c.registration_expiry && c.registration_expiry <= soonEnough) {
      add(c.registration_expiry, `${c.name} — certifier registration expires`, "Renew with the registration body, then update the date in Settings", "/settings?section=certifiers");
    }
    if (c.pi_insurance_expiry && c.pi_insurance_expiry <= soonEnough) {
      add(c.pi_insurance_expiry, `${c.name} — PI insurance expires`, "Renew the policy, then update the date in Settings", "/settings?section=certifiers");
    }
  }

  for (const invoice of invoices || []) {
    if (invoice.due_date && invoice.due_date < todayIso) {
      add(invoice.due_date, `Invoice ${invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase()} overdue`, invoice.reference || "", `/invoices/${invoice.id}`);
    }
  }

  items.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  return items;
}
