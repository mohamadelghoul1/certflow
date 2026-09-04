"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building2, HardHat, BarChart3, Settings } from "lucide-react";

// A phone-sized way around the app. The top bar's dropdowns are built for
// a cursor and are awkward on a small screen, so on phones the main
// destinations move to a fixed bar at the bottom, within thumb reach.
// Hidden from tablet width up, where the top bar has room to work.
const TABS = [
  { href: "/dashboard", label: "Home", icon: Home, directorOnly: false },
  { href: "/jobs", label: "Projects", icon: Building2, directorOnly: false },
  // On site earns its place on a phone more than Quotes does: this bar
  // is what an inspector taps standing on a slab.
  { href: "/site", label: "On site", icon: HardHat, directorOnly: false },
  { href: "/reports", label: "Reports", icon: BarChart3, directorOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, directorOnly: false },
];

// director: a team member's bar has no Reports — those are the firm's.
export function MobileTabBar({ director = true }: { director?: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => director || !t.directorOnly);

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className={`grid ${tabs.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${active ? "text-secondary" : "text-muted"}`}
            >
              <Icon size={19} strokeWidth={active ? 2.2 : 1.7} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
