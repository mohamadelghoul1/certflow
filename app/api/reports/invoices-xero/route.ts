import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { xeroInvoiceCsv, type XeroInvoice } from "@/lib/invoices/xeroCsv";
import { financialYearStart } from "@/lib/issuanceRegister";
import { todayISO } from "@/lib/business";

// The firm's issued invoices as a file Xero can import.
//
// Drafts are never included: a draft is the certifier still writing it,
// and a draft in the books is a number the accountant has to chase.
// Voided invoices are left out for the same reason — they ask for
// nothing. Paid ones are included, because the invoice still has to
// exist in Xero before a payment can be matched against it.
export async function GET(request: NextRequest) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const from = request.nextUrl.searchParams.get("from") || financialYearStart(todayISO());
  const to = request.nextUrl.searchParams.get("to") || todayISO();
  // Defaults are Xero's own Australian ones — Sales, GST on Income. A
  // firm with its own chart of accounts overrides them on the form.
  const accountCode = (request.nextUrl.searchParams.get("account") || "200").trim().slice(0, 20);
  const taxType = (request.nextUrl.searchParams.get("tax") || "OUTPUT").trim().slice(0, 40);

  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, issue_date, due_date, bill_to, reference, status, clients(name, email), invoice_lines(description, quantity, amount, sort_order)")
    .eq("firm_id", profile.firm_id)
    .in("status", ["sent", "paid"])
    .gte("issue_date", from)
    .lte("issue_date", to)
    .order("issue_date");

  const invoices: XeroInvoice[] = ((data || []) as unknown as (XeroInvoice & { clients: { name: string | null; email: string | null } | null; invoice_lines: XeroInvoice["lines"] })[]).map(
    (row) => ({
      ...row,
      client_name: row.clients?.name ?? null,
      client_email: row.clients?.email ?? null,
      lines: row.invoice_lines || [],
    })
  );

  // The byte-order mark is what makes Excel read the file as UTF-8 —
  // without it, a client name with an accent arrives mangled.
  return new NextResponse(`﻿${xeroInvoiceCsv(invoices, { accountCode, taxType })}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-for-xero-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
