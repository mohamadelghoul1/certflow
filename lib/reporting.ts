import { createClient } from "@/lib/supabase/server";
import { stageComplete } from "@/lib/business";
import { excludingDeleted } from "@/lib/softDelete";
import { getRecordedEvents } from "@/lib/audit";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type IssuanceEvent = { type: "CDC" | "CC" | "NOC" | "OC"; date: Date };

// Every certificate/NOC/OC issued for this firm, across all jobs — used to
// build the issuance report bucketed by month/year/all-time.
export async function getIssuanceEvents(supabase: SupabaseServerClient, firmId: string): Promise<IssuanceEvent[]> {
  const events: IssuanceEvent[] = [];

  const { data: jobs } = await excludingDeleted((live) => {
    const query = supabase.from("jobs").select("id, pathway, pathway_generated, pathway_generated_date").eq("firm_id", firmId);
    return live ? query.is("deleted_at", null) : query;
  });
  for (const j of jobs || []) {
    if (j.pathway_generated && j.pathway_generated_date) {
      events.push({ type: j.pathway as "CDC" | "CC", date: new Date(j.pathway_generated_date) });
    }
  }

  const { data: nocChecklists } = await excludingDeleted((live) => {
    const query = supabase
      .from("checklists")
      .select("checklist_items(status, updated_at), jobs!inner(firm_id)")
      .eq("kind", "noc")
      .eq("jobs.firm_id", firmId);
    return live ? query.is("jobs.deleted_at", null) : query;
  });
  for (const c of nocChecklists || []) {
    const items = (c.checklist_items || []) as { status: "requested" | "submitted" | "approved"; updated_at: string }[];
    if (stageComplete(items)) {
      const dates = items.map((i) => new Date(i.updated_at).getTime());
      if (dates.length) events.push({ type: "NOC", date: new Date(Math.max(...dates)) });
    }
  }

  const { data: ocRecords } = await excludingDeleted((live) => {
    const query = supabase.from("oc_records").select("generated_date, jobs!inner(firm_id)").eq("jobs.firm_id", firmId);
    return live ? query.is("jobs.deleted_at", null) : query;
  });
  for (const r of ocRecords || []) {
    if (r.generated_date) events.push({ type: "OC", date: new Date(r.generated_date) });
  }

  return events;
}

export type AuditEvent = { certifierId: string; type: "cdc_cc" | "modification" | "oc" | "inspection"; action: string; address: string; date: string };

// Every action a certifier has actually carried out — issuances,
// modifications, OCs, inspections — across all jobs for this firm.
export async function getAuditEvents(supabase: SupabaseServerClient, firmId: string): Promise<AuditEvent[]> {
  const events: AuditEvent[] = [];

  const { data: jobs } = await excludingDeleted((live) => {
    const query = supabase
      .from("jobs")
      .select("id, address, pathway, pathway_generated, pathway_generated_date, pathway_issued_by")
      .eq("firm_id", firmId);
    return live ? query.is("deleted_at", null) : query;
  });
  for (const j of jobs || []) {
    if (j.pathway_generated && j.pathway_issued_by && j.pathway_generated_date) {
      events.push({ certifierId: j.pathway_issued_by, type: "cdc_cc", action: `Issued ${j.pathway} certificate`, address: j.address, date: j.pathway_generated_date });
    }
  }

  const { data: modifications } = await excludingDeleted((live) => {
    const query = supabase
      .from("modifications")
      .select("generated, generated_date, issued_by, jobs!inner(firm_id, address, pathway)")
      .eq("jobs.firm_id", firmId)
      .eq("generated", true);
    return live ? query.is("jobs.deleted_at", null) : query;
  });
  for (const m of modifications || []) {
    if (m.issued_by && m.generated_date) {
      const job = m.jobs as unknown as { address: string; pathway: string };
      events.push({ certifierId: m.issued_by, type: "modification", action: `Issued modification to ${job.pathway}`, address: job.address, date: m.generated_date });
    }
  }

  const { data: ocRecords } = await excludingDeleted((live) => {
    const query = supabase.from("oc_records").select("type, generated_date, issued_by, jobs!inner(firm_id, address)").eq("jobs.firm_id", firmId);
    return live ? query.is("jobs.deleted_at", null) : query;
  });
  for (const r of ocRecords || []) {
    if (r.issued_by && r.generated_date) {
      const job = r.jobs as unknown as { address: string };
      events.push({ certifierId: r.issued_by, type: "oc", action: `Issued ${r.type === "whole" ? "Whole" : "Partial"} Occupation Certificate`, address: job.address, date: r.generated_date });
    }
  }

  const { data: inspections } = await excludingDeleted((live) => {
    const query = supabase
      .from("inspections")
      .select("title, date, outcome, inspector_certifier_id, jobs!inner(firm_id, address)")
      .eq("jobs.firm_id", firmId)
      .neq("outcome", "pending");
    return live ? query.is("jobs.deleted_at", null) : query;
  });
  for (const i of inspections || []) {
    if (i.inspector_certifier_id && i.date) {
      const job = i.jobs as unknown as { address: string };
      const outcomeLabel = i.outcome === "passed" ? "Passed" : i.outcome === "failed" ? "Failed" : "Passed subject to conditions";
      events.push({ certifierId: i.inspector_certifier_id, type: "inspection", action: `Carried out inspection — ${i.title} (${outcomeLabel})`, address: job.address, date: i.date });
    }
  }

  return events;
}
