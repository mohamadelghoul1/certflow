import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargeFor, monthKey, planFor, usageCsv, type FirmPlan, type FirmUsageRow } from "@/lib/billing";

// The month as a spreadsheet — what a bookkeeper is given so the
// invoices can be raised without anyone reading it off a screen.
export async function GET(request: NextRequest) {
  await requirePlatformOwner();
  const month = request.nextUrl.searchParams.get("month") || "";
  const key = /^\d{4}-\d{2}$/.test(month) ? month : monthKey();

  const supabase = await createClient();
  const [{ data: usageRows, error }, { data: planRows }] = await Promise.all([
    supabase.rpc("firm_usage", { p_month: key }),
    supabase.from("firm_plans").select("*"),
  ]);
  if (error) return new NextResponse("Run database update 0076 first.", { status: 400 });

  const plans = (planRows || []) as FirmPlan[];
  const rows = ((usageRows || []) as FirmUsageRow[]).map((firm) => {
    const plan = planFor(plans, firm.firm_id);
    return { firm, plan, charge: plan ? chargeFor(plan, key, Number(firm.billable_projects)) : null };
  });

  return new NextResponse(usageCsv(rows, key), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Certlyn firms ${key}.csv"`,
    },
  });
}
