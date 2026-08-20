import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import { NavDropdown } from "@/components/certifier/NavDropdown";

type Item = { id: string; title: string; subtitle: string };

export function NavBar({ firmName, recentJobs, recentQuotes }: { firmName: string; recentJobs: Item[]; recentQuotes: Item[] }) {
  return (
    <div className="flex items-center justify-between bg-slate-900 border-b border-amber-900/40 px-6">
      <div className="flex items-center overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <Link href="/dashboard" className="font-serif font-bold tracking-wide text-lg py-4 pr-6 text-amber-300 shrink-0 whitespace-nowrap">
          CERTFLOW
        </Link>
        <NavDropdown
          label="Projects"
          items={recentJobs}
          viewAllHref="/jobs"
          viewAllLabel="View all projects"
          createHref="/jobs/new"
          createLabel="New project"
          itemHrefBase="/jobs"
          itemHrefSuffix="?tab=pathway"
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
        <Link href="/reports" className="py-4 px-3 text-sm font-semibold text-slate-200 hover:text-amber-300 shrink-0 whitespace-nowrap">
          Reports
        </Link>
        <Link href="/audit" className="py-4 px-3 text-sm font-semibold text-slate-200 hover:text-amber-300 shrink-0 whitespace-nowrap">
          Audit
        </Link>
        <Link href="/settings" className="py-4 px-3 text-sm font-semibold text-slate-200 hover:text-amber-300 shrink-0 whitespace-nowrap">
          Settings
        </Link>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-slate-400 text-xs hidden sm:inline">{firmName}</span>
        <form action={signOut}>
          <button className="text-xs text-slate-400 hover:text-amber-300 py-4">Sign out</button>
        </form>
      </div>
    </div>
  );
}
