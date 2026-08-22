"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A top-bar link that shows where you are. The accent underline marks
// both hover and the current page, which is what the colour system asks
// for — on the dark nav it's the one colour that reads clearly without
// competing with the white text.
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`py-4 px-3 text-sm font-medium shrink-0 whitespace-nowrap border-b-2 ${
        active ? "text-white border-icon" : "text-white/80 border-transparent hover:text-white hover:border-icon"
      }`}
    >
      {children}
    </Link>
  );
}
