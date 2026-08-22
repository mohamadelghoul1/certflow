"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building2, FileText, BarChart3, Settings } from "lucide-react";

// A phone-sized way around the app. The top bar's dropdowns are built for
// a cursor and are awkward on a small screen, so on phones the main
// destinations move to a fixed bar at the bottom, within thumb reach.
// Hidden from tablet width up, where the top bar has room to work.
const TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/jobs", label: "Projects", icon: Building2 },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
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
