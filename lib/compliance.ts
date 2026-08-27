import type { SupabaseClient } from "@supabase/supabase-js";
import { portalReportDeadline, calcCdcLapseDate, issuesCertificate, type Pathway } from "@/lib/business";
import type { ChecklistItem } from "@/types/db";

// Every deadline the firm is currently standing under, in one list.
//
// A certifier's real exposure is spread across screens: a certificate
// issued but not yet reported to the Portal (2 business days), an
// inspection carried out but never resulted or reported, a registration
// or PI insurance quietly running out, an invoice past its due date, a
// CDC approaching its five-year lapse. Each is visible somewhere; none
// were visible together. This gathers them, dated, sorted by how much
// trouble they'd cause, each row linking to the place it gets fixed.

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
  status: string;
  pathway_generated: boolean;
  pathway_generated_date: string | null;
  pathway_portal_reported: boolean;
  pathway_approval_date: string | null;
  checklists: { kind: string; checklist_items: Pick<ChecklistItem, "status">[] }[];
  inspections: { id: string; title: string; date: string | null; outcome: string; portal_reported: boolean }[];
  oc_records: { id: string; generated_date: string | null; portal_reported: boolean }[];
};

export async function getComplianceItems(supabase: SupabaseClient, firmId: string, todayIso: string): Promise<ComplianceItem[]> {
  const [{ data: jobs }, { data: certifiers }, { data: invoices }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, address, pathway, status, pathway_generated, pathway_generated_date, pathway_portal_reported, pathway_approval_date, checklists(kind, checklist_items(status)), inspections(id, title, date, outcome, portal_reported), oc_records(id, generated_date, portal_reported)"
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

  for (const job of (jobs || []) as unknown as JobRow[]) {
    // A CDC/CC issued but not yet reported to the Portal — the two
    // business day clock, the sharpest statutory edge a certifier has.
    if (issuesCertificate(job.pathway) && job.pathway_generated && !job.pathway_portal_reported && job.pathway_generated_date) {
      add(
        portalReportDeadline(job.pathway_generated_date),
        `Report ${job.pathway} issuance to the Planning Portal`,
        job.address,
        `/jobs/${job.id}?tab=pathway`
      );
    }

    for (const oc of job.oc_records || []) {
      if (oc.generated_date && !oc.portal_reported) {
        add(portalReportDeadline(oc.generated_date), "Report OC issuance to the Planning Portal", job.address, `/jobs/${job.id}?tab=oc`);
      }
    }

    for (const inspection of job.inspections || []) {
      if (!inspection.date) continue;
      // Carried out and resulted, but never reported — same 2-day clock.
      if (["passed", "failed", "passed_subject_to"].includes(inspection.outcome) && !inspection.portal_reported) {
        add(
          portalReportDeadline(inspection.date),
          "Report inspection to the Planning Portal",
          `${inspection.title} — ${job.address}`,
          `/jobs/${job.id}?tab=inspections`
        );
      }
      // Its date has passed and no outcome was ever recorded: either it
      // didn't happen, or it happened and the record is missing. Both
      // need a certifier's hand.
      if (inspection.outcome === "pending" && inspection.date < todayIso) {
        add(inspection.date, "Inspection past its date with no result recorded", `${inspection.title} — ${job.address}`, `/jobs/${job.id}?tab=inspections`);
      }
    }

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
