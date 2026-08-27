import Link from "next/link";
import { NavLink } from "@/components/certifier/NavLink";
import { signOut } from "@/lib/actions/auth";
import { NavDropdown } from "@/components/certifier/NavDropdown";
import { SearchEverywhere } from "@/components/certifier/SearchEverywhere";
import { LogOut } from "lucide-react";

type Item = { id: string; title: string; subtitle: string };

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function NavBar({ firmName, userName, recentJobs, recentQuotes }: { firmName: string; userName: string; recentJobs: Item[]; recentQuotes: Item[] }) {
  return (
    <div className="flex items-center justify-between bg-primary px-4 sm:px-6">
      <div className="flex items-center overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <Link href="/dashboard" className="flex items-center gap-2 py-4 pr-6 shrink-0 whitespace-nowrap">
          <span className="w-7 h-7 rounded-md bg-secondary text-white text-xs font-bold flex items-center justify-center">CF</span>
          <span className="font-semibold tracking-tight text-base text-white">CertFlow</span>
        </Link>
        <div className="hidden sm:contents">
        <NavDropdown
          label="Projects"
          items={recentJobs}
          viewAllHref="/jobs"
          viewAllLabel="View all projects"
          createHref="/jobs/new"
          createLabel="New project"
          itemHrefBase="/jobs"
          itemHrefSuffix="?tab=pathway"
          extraLinks={[
            { href: "/jobs?pathway=CDC", label: "CDC projects" },
            { href: "/jobs?pathway=CC", label: "CC projects" },
            { href: "/jobs?pathway=PC_OC", label: "PC / OC projects" },
            { href: "/jobs?issued=issued", label: "Issued certificates" },
            { href: "/jobs?issued=not-issued", label: "Not issued yet" },
          ]}
        />
        <NavDropdown
          label="Quotes"
          items={recentQuotes}
          viewAllHref="/quotes"
          viewAllLabel="View all quotes"
          createHref="/quotes/new"
          createLabel="New quote"
          itemHrefBase="/quotes"
        />
        <NavLink href="/invoices">Invoices</NavLink>
        <NavLink href="/compliance">Compliance</NavLink>
        <NavLink href="/audit">Audit</NavLink>
        <NavLink href="/settings">Settings</NavLink>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <SearchEverywhere />
        <span className="text-white/70 text-xs hidden sm:inline">{firmName}</span>
        <span
          title={userName}
          className="w-8 h-8 rounded-full bg-icon border border-white text-white text-xs font-semibold flex items-center justify-center shrink-0"
        >
          {initialsOf(userName)}
        </span>
        <form action={signOut}>
          <button aria-label="Sign out" title="Sign out" className="p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10">
            <LogOut size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
