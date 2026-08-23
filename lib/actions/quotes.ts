"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultScopeOfWorks, defaultCriticalStageInspections, COUNCIL_DIRECTORY } from "@/lib/constants";
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

function extractQuoteFields(formData: FormData) {
  const pathway = String(formData.get("pathway") || "CDC") as "CDC" | "CC";
  const ownerIsApplicant = formData.get("owner_is_applicant") === "on";
  const scopeOfWorks = formData.getAll("scope_item").map(String).filter((s) => s.trim().length > 0);

  return {
    pathway,
    ownerIsApplicant,
    scopeOfWorks,
    fields: {
      state: String(formData.get("state") || "NSW"),
      project_type: String(formData.get("project_type") || "") || null,
      pathway,
      required_start_date: String(formData.get("required_start_date") || "") || null,
      required_end_date: String(formData.get("required_end_date") || "") || null,
      valid_for: String(formData.get("valid_for") || "7 Days"),
      proposal_address: String(formData.get("proposal_address") || ""),
      lot_section_plan: String(formData.get("lot_section_plan") || ""),
      certifier_id: String(formData.get("certifier_id") || "") || null,
      classifications: formData.getAll("classifications").map(String),
      development_description: String(formData.get("development_description") || ""),
      owner_is_applicant: ownerIsApplicant,
      council_lga: String(formData.get("council_lga") || ""),
      client_id: String(formData.get("client_id") || "") || null,
      applicant: {
        name: String(formData.get("applicant_name") || ""),
        email: String(formData.get("applicant_email") || ""),
        phone: String(formData.get("applicant_phone") || ""),
        address: {
          streetNumber: String(formData.get("applicant_streetNumber") || ""),
          street: String(formData.get("applicant_street") || ""),
          suburb: String(formData.get("applicant_suburb") || ""),
          state: String(formData.get("applicant_state") || "NSW"),
          postcode: String(formData.get("applicant_postcode") || ""),
        },
      },
      owner: ownerIsApplicant
        ? {}
        : {
            name: String(formData.get("owner_name") || ""),
            phone: String(formData.get("owner_phone") || ""),
            email: String(formData.get("owner_email") || ""),
          },
      scope_of_works: scopeOfWorks.length > 0 ? scopeOfWorks : defaultScopeOfWorks(pathway),
    },
  };
}

function extractFeeLines(formData: FormData) {
  const feeDescriptions = formData.getAll("fee_description").map(String);
  const feeAmounts = formData.getAll("fee_amount").map(String);
  // Each line is a description and its fee — the quantity column is gone
  // from the form, so every stored line carries the neutral quantity of 1.
  return feeDescriptions
    .map((description, idx) => ({ description, quantity: "1", amount: Number(feeAmounts[idx]) || 0, sort_order: idx }))
    .filter((l) => l.description.trim().length > 0);
}

export async function createQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const { pathway, fields } = extractQuoteFields(formData);

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({ firm_id: profile.firm_id, ...fields })
    .select("id")
    .single();

  if (error || !quote) return { error: error?.message || "Could not create quote." };

  const feeLines = extractFeeLines(formData);
  if (feeLines.length > 0) {
    await supabase.from("quote_fee_lines").insert(feeLines.map((l) => ({ ...l, quote_id: quote.id })));
  } else {
    await supabase.from("quote_fee_lines").insert({ quote_id: quote.id, description: `${pathway}/PC/OC`, quantity: "1", amount: 2500, sort_order: 0 });
  }

  redirect(`/quotes/${quote.id}`);
}

export async function updateQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id"));
  const { fields } = extractQuoteFields(formData);

  const { error } = await supabase.from("quotes").update(fields).eq("id", quoteId).eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };

  const feeLines = extractFeeLines(formData);
  await supabase.from("quote_fee_lines").delete().eq("quote_id", quoteId);
  if (feeLines.length > 0) {
    await supabase.from("quote_fee_lines").insert(feeLines.map((l) => ({ ...l, quote_id: quoteId })));
  }

  revalidatePath(`/quotes/${quoteId}`);
  return undefined;
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

export async function updateQuoteTerms(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id"));
  const termsOverride = String(formData.get("terms_override") || "");
  await supabase.from("quotes").update({ terms_override: termsOverride || null }).eq("id", quoteId);
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/quotes/${quoteId}/document`);
}

export async function deleteQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id"));
  const typed = String(formData.get("confirm_address") || "").trim();

  const { data: quote } = await supabase.from("quotes").select("id, proposal_address, linked_job_id").eq("id", quoteId).eq("firm_id", profile.firm_id).single();
  if (!quote) return { error: "That quote could not be found." };

  const expected = (quote.proposal_address || "").trim();
  if (typed.toLowerCase() !== expected.toLowerCase()) {
    return { error: "The address you typed doesn't match this quote's proposal address, so nothing has been deleted." };
  }

  // The fee lines go with the quote via the schema's cascade. A project
  // already generated from this quote is its own record and stays.
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId).eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };

  redirect("/quotes");
}

export async function generateJobFromQuote(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const quoteId = String(formData.get("quote_id"));

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).eq("firm_id", profile.firm_id).single();
  if (!quote || quote.status !== "accepted") return;

  const applicant = quote.applicant as { name?: string; email?: string; phone?: string; address?: Record<string, string> };
  const owner = quote.owner as { name?: string; email?: string; phone?: string };

  // The quote is the intake: everything the client already told us goes
  // onto the job, so the Details tab opens with only the genuinely new
  // questions left to answer.
  const councilMatch = COUNCIL_DIRECTORY.find((c) => c.name === (quote.council_lga || ""));
  const scopeList = (quote.scope_of_works || []) as string[];

  const { data: job } = await supabase
    .from("jobs")
    .insert({
      firm_id: profile.firm_id,
      address: quote.proposal_address || "",
      description: quote.development_description || scopeList.filter((s) => s.trim()).join("; ") || "",
      pathway: quote.pathway,
      job_types: quote.project_type ? [quote.project_type] : [],
      assigned_certifier_id: quote.certifier_id,
      client_id: quote.client_id,
      critical_stage_inspections: defaultCriticalStageInspections(),
      details: {
        contact: { nameOrCompany: applicant?.name || "", email: applicant?.email || "", phone: applicant?.phone || "" },
        applicantAddress: applicant?.address,
        council: councilMatch
          ? { lga: councilMatch.name, address: councilMatch.address, contact: { phone: councilMatch.phone, email: councilMatch.email } }
          : { lga: quote.council_lga || "" },
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
