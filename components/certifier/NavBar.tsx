import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export function NavBar({ firmName }: { firmName: string }) {
  return (
    <div className="flex items-center justify-between bg-slate-900 border-b border-amber-900/40 px-6">
      <div className="flex items-center overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <Link href="/dashboard" className="font-serif font-bold tracking-wide text-lg py-4 pr-6 text-amber-300 shrink-0 whitespace-nowrap">
          CERTFLOW
        </Link>
        <Link href="/jobs" className="py-4 px-3 text-sm font-semibold text-slate-200 hover:text-amber-300 shrink-0 whitespace-nowrap">
          Jobs
        </Link>
        <Link href="/jobs/new" className="py-4 px-3 text-sm font-semibold text-slate-200 hover:text-amber-300 shrink-0 whitespace-nowrap">
          New Job
        </Link>
        <Link href="/quotes" className="py-4 px-3 text-sm font-semibold text-slate-200 hover:text-amber-300 shrink-0 whitespace-nowrap">
          Quotes
        </Link>
        <Link href="/quotes/new" className="py-4 px-3 text-sm font-semibold text-slate-200 hover:text-amber-300 shrink-0 whitespace-nowrap">
          New Quote
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
