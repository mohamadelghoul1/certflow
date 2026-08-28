import { requireProfile } from "@/lib/auth";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

// On-site mode: the app as it is needed standing on a slab, rather than
// sitting at a desk.
//
// Its own layout, deliberately without the nav bar, the search box, the
// tab bar and the recent-projects dropdowns. Everything here is one
// column, thumb-sized, and reachable without a second hand — a person
// holding a phone in one hand and a tape measure in the other has no use
// for a menu built for a cursor.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await requireProfile("certifier");

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 bg-primary text-white pt-[env(safe-area-inset-top)]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/site" className="text-base font-bold tracking-tight">
            On site
          </Link>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white">
            <LayoutDashboard size={15} /> Full app
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );
}
