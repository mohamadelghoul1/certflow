import { redirect } from "next/navigation";

// Reports merged into the Audit page as its "Issuance report" screen;
// the old address keeps working for anyone's bookmark.
export default function ReportsPage() {
  redirect("/audit?section=reports");
}
