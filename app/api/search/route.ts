import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// One box over everything the firm holds. Each table is asked the same
// question in its own words, firm-scoped and capped, and the answers
// come back grouped so an address, a client and an invoice that all
// match sit under their own headings.

export type SearchHit = { label: string; sub: string; href: string };
export type SearchResults = { group: string; hits: SearchHit[] }[];

// PostgREST's or() filter is comma-delimited with its own operators, so
// the searched text must not be able to smuggle any of that in.
function sanitise(q: string): string {
  return q.replace(/[,()%*\\]/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const q = sanitise(request.nextUrl.searchParams.get("q") || "");
  if (q.length < 2) return NextResponse.json({ results: [] });
  const like = `*${q}*`;

  const [{ data: jobs }, { data: clients }, { data: quotes }, { data: invoices }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, address, description, pathway, details")
      .eq("firm_id", profile.firm_id)
      .is("deleted_at", null)
      .or(`address.ilike.${like},description.ilike.${like},details->>projectNumber.ilike.${like}`)
      .limit(6),
    supabase.from("clients").select("id, name, email").eq("firm_id", profile.firm_id).or(`name.ilike.${like},email.ilike.${like}`).limit(5),
    supabase
      .from("quotes")
      .select("id, proposal_address, project_title, quote_number")
      .eq("firm_id", profile.firm_id)
      .or(`proposal_address.ilike.${like},project_title.ilike.${like},quote_number.ilike.${like}`)
      .limit(5),
    supabase
      .from("invoices")
      .select("id, invoice_number, reference, status")
      .eq("firm_id", profile.firm_id)
      .or(`invoice_number.ilike.${like},reference.ilike.${like}`)
      .limit(5),
  ]);

  const results: SearchResults = [];
  if (jobs?.length) {
    results.push({
      group: "Projects",
      hits: jobs.map((j) => ({
        label: j.address,
        sub: [j.pathway, (j.details as { projectNumber?: string } | null)?.projectNumber, j.description].filter(Boolean).join(" · ").slice(0, 80),
        href: `/jobs/${j.id}?tab=pathway`,
      })),
    });
  }
  if (clients?.length) {
    results.push({
      group: "Clients",
      hits: clients.map((c) => ({ label: c.name, sub: c.email || "", href: "/settings?section=clients" })),
    });
  }
  if (quotes?.length) {
    results.push({
      group: "Quotes",
      hits: quotes.map((quote) => ({ label: quote.proposal_address || quote.project_title || "Untitled quote", sub: quote.quote_number || "", href: `/quotes/${quote.id}` })),
    });
  }
  if (invoices?.length) {
    results.push({
      group: "Invoices",
      hits: invoices.map((inv) => ({ label: inv.invoice_number || inv.id.slice(0, 8).toUpperCase(), sub: inv.reference || "", href: `/invoices/${inv.id}` })),
    });
  }

  return NextResponse.json({ results });
}
