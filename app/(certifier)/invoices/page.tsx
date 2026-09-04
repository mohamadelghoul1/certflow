import { requireDirector } from "@/lib/auth";
import { MoneyAndDeadlines } from "@/components/certifier/MoneyAndDeadlines";

// The money half of the one page that answers "what still needs
// chasing". Its own address, so a link to it keeps working.
export default async function InvoicesPage() {
  const { profile } = await requireDirector();
  return <MoneyAndDeadlines firmId={profile.firm_id} tab="invoices" />;
}
