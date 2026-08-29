import { requireProfile } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import Link from "next/link";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile("client");

  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-primary-700 text-white px-6 py-4 flex items-center justify-between">
        <Link href="/portal" className="font-serif font-bold tracking-wide text-lg">
          CERTLYN
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-icon-300 text-sm hidden sm:inline">{profile.full_name || profile.email}</span>
          <form action={signOut}>
            <button className="text-xs text-icon-300 hover:text-white">Sign out</button>
          </form>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
