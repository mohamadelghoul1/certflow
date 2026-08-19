"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultScopeOfWorks, MANDATORY_CRITICAL_STAGE_INSPECTIONS } from "@/lib/constants";
import { INSPECTION_LIBRARY } from "@/lib/constants";
import type { ActionState } from "@/lib/actions/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

async function firmLibrary(supabase: SupabaseClient, firmId: string, pathway: string) {
  const { data } = await supabase
    .from("document_library_items")
    .select("title, description, category")
    .eq("firm_id", firmId)
    .eq("pathway", pathway)
    .order("sort_order");
  return data || [];
}

export async function createQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const pathway = String(formData.get("pathway") || "CDC") as "CDC" | "CC";

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      firm_id: profile.firm_id,
      pathway,
      proposal_address: String(formData.get("proposal_address") || ""),
      project_title: String(formData.get("project_title") || ""),
      certifier_id: String(formData.get("certifier_id") || "") || null,
      development_description: String(formData.get("development_description") || ""),
      council_lga: String(formData.get("council_lga") || ""),
      client_id: String(formData.get("client_id") || "") || null,
      applicant: {
        name: String(formData.get("applicant_name") || ""),
        email: String(formData.get("applicant_email") || ""),
        phone: String(formData.get("applicant_phone") || ""),
      },
      scope_of_works: defaultScopeOfWorks(pathway),
    })
    .select("id")
    .single();

  if (error || !quote) return { error: error?.message || "Could not create quote." };

  await supabase.from("quote_fee_lines").insert({ quote_id: quote.id, description: `${pathway}/PC/OC`, quantity: "1", amount: 2500, sort_order: 0 });

  redirect(`/quotes/${quote.id}`);
}

export async function addFeeLine(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id"));
  const description = String(formData.get("description") || "");
  const amount = Number(formData.get("amount") || 0);
  if (!description) return;
  await supabase.from("quote_fee_lines").insert({ quote_id: quoteId, description, quantity: "1", amount });
  revalidatePath(`/quotes/${quoteId}`);
}

export async function removeFeeLine(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id"));
  const lineId = String(formData.get("line_id"));
  await supabase.from("quote_fee_lines").delete().eq("id", lineId);
  revalidatePath(`/quotes/${quoteId}`);
}

export async function setQuoteStatus(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id"));
  const status = String(formData.get("status"));
  await supabase.from("quotes").update({ status }).eq("id", quoteId);
  revalidatePath(`/quotes/${quoteId}`);
}

export async function markQuotePaid(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id"));
  await supabase.from("quotes").update({ payment_status: "paid", payment_received_date: new Date().toISOString().slice(0, 10) }).eq("id", quoteId);
  revalidatePath(`/quotes/${quoteId}`);
}

export async function generateJobFromQuote(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id"));

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).eq("firm_id", profile.firm_id).single();
  if (!quote || quote.status !== "accepted") return;

  const applicant = quote.applicant as { name?: string; email?: string; phone?: string };
  const owner = quote.owner as { name?: string; email?: string; phone?: string };

  const { data: job } = await supabase
    .from("jobs")
    .insert({
      firm_id: profile.firm_id,
      address: quote.proposal_address || "",
      description: quote.development_description || "",
      pathway: quote.pathway,
      assigned_certifier_id: quote.certifier_id,
      client_id: quote.client_id,
      critical_stage_inspections: MANDATORY_CRITICAL_STAGE_INSPECTIONS.map((i) => i.no),
      details: {
        contact: { nameOrCompany: applicant?.name || "", email: applicant?.email || "", phone: applicant?.phone || "" },
        council: { lga: quote.council_lga || "" },
        ownerSameAsApplicant: quote.owner_is_applicant,
        owner: quote.owner_is_applicant ? undefined : { name: owner?.name || "", phone: owner?.phone || "" },
        proposal: { classifications: quote.classifications || [] },
        certificateDetails: { lotSectionDp: quote.lot_section_plan || "" },
      },
    })
    .select("id")
    .single();

  if (!job) return;

  const kinds: { kind: "pathway" | "noc" | "oc"; libraryKey: string }[] = [
    { kind: "pathway", libraryKey: quote.pathway },
    { kind: "noc", libraryKey: "NOC" },
    { kind: "oc", libraryKey: "OC" },
  ];
  for (const { kind, libraryKey } of kinds) {
    const { data: checklist } = await supabase.from("checklists").insert({ job_id: job.id, kind }).select("id").single();
    if (!checklist) continue;
    const library = await firmLibrary(supabase, profile.firm_id, libraryKey);
    const items = library.map((doc, idx) => ({ checklist_id: checklist.id, title: doc.title, description: doc.description, category: doc.category, sort_order: idx }));
    if (items.length) await supabase.from("checklist_items").insert(items);
  }
  const inspections = INSPECTION_LIBRARY.map((i) => ({ job_id: job.id, title: i.title, description: i.desc, inspector_certifier_id: quote.certifier_id }));
  await supabase.from("inspections").insert(inspections);

  await supabase.from("quotes").update({ linked_job_id: job.id }).eq("id", quoteId);

  redirect(`/jobs/${job.id}`);
}
