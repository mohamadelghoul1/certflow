import { requireProfile } from "@/lib/auth";
import { MoneyAndDeadlines } from "@/components/certifier/MoneyAndDeadlines";

// The deadlines half of the same page. Every compliance row in an email
// or a bookmark still lands here.
export default async function CompliancePage() {
  const { profile } = await requireProfile("certifier");
  return <MoneyAndDeadlines firmId={profile.firm_id} tab="deadlines" />;
}
