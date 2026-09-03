import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";

// The frame around the public pages — the ones a certifier reads before
// they have a login. Same dark, gold-lined shopfront as the front door,
// with a bar across the top so the three pages and the sign-in are one
// tap from each other.

export const MARKETING_PAGES = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/why-certlyn", label: "Why Certlyn" },
  { href: "/join", label: "For certifiers" },
];

export function MarketingShell({ current, children }: { current: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b111a] text-white">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0b111a]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={28} id="certlyn-nav-gold" />
            <span className="font-serif text-2xl font-medium tracking-tight">
              Cert<span className="text-[#f0b93a]">lyn</span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-6 text-[14px] sm:flex">
            {MARKETING_PAGES.map((page) => (
              <Link key={page.href} href={page.href} className={page.href === current ? "font-semibold text-[#f0b93a]" : "text-slate-300 hover:text-white"}>
                {page.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/login"
            className="ml-auto sm:ml-0 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#f6c554] to-[#e8a92d] px-4 py-2 text-[13px] font-bold text-[#241b06]"
          >
            Sign in <ArrowRight size={14} />
          </Link>
        </div>
        <nav className="flex items-center gap-5 overflow-x-auto px-6 pb-3 text-[13px] sm:hidden">
          {MARKETING_PAGES.map((page) => (
            <Link key={page.href} href={page.href} className={`whitespace-nowrap ${page.href === current ? "font-semibold text-[#f0b93a]" : "text-slate-300"}`}>
              {page.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16">{children}</main>

      <footer className="border-t border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-[13px] text-slate-400 sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#f0b93a]" />
            Trusted by certifiers. <span className="font-semibold text-[#f0b93a]">Built for compliance.</span>
          </span>
          <span className="sm:ml-auto">
            <Link href="/join" className="hover:text-white">
              Register your interest
            </Link>
            <span className="mx-3 text-slate-700">·</span>
            <Link href="/client-login" className="hover:text-white">
              Client portal
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

// The pieces the three pages are laid out from, so they read as one
// set rather than three essays.

export function Hero({ kicker, title, children }: { kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="pt-14 pb-10 sm:pt-20">
      <div className="text-[12px] tracking-[0.35em] uppercase text-slate-400">{kicker}</div>
      <div className="mt-4 h-px w-16 bg-[#f0b93a]" />
      <h1 className="mt-6 max-w-3xl text-[34px] font-bold leading-[1.15] sm:text-5xl">{title}</h1>
      {children && <div className="mt-5 max-w-2xl text-[17px] leading-relaxed text-slate-300">{children}</div>}
    </section>
  );
}

export function Section({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="py-10 border-t border-slate-800/80">
      <h2 className="text-[26px] font-bold leading-tight sm:text-3xl">{title}</h2>
      {lead && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-slate-300">{lead}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-[#0e1520]/80 p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#f0b93a]/35 bg-[#f0b93a]/5 text-[#f0b93a]">{icon}</div>
      <h3 className="mt-4 text-[18px] font-bold">{title}</h3>
      <div className="mt-2 text-[15px] leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

export function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-16">
      <span className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-[#f6c554] to-[#e8a92d] text-[17px] font-bold text-[#241b06]">
        {number}
      </span>
      <h3 className="pt-2 text-[20px] font-bold">{title}</h3>
      <div className="mt-2 text-[15px] leading-relaxed text-slate-300">{children}</div>
    </li>
  );
}

export function CallToAction({ title, blurb }: { title: string; blurb: string }) {
  return (
    <section className="mt-6 rounded-2xl bg-gradient-to-b from-[#f6c554] to-[#e8a92d] p-7 text-[#241b06] sm:p-10">
      <h2 className="text-[26px] font-bold leading-tight sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[#4a3a10]">{blurb}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href="/join" className="inline-flex items-center gap-2 rounded-full bg-[#181c14] px-6 py-3 text-[15px] font-bold text-[#f0b93a]">
          Register your interest <ArrowRight size={17} />
        </Link>
        <Link href="/how-it-works" className="text-[15px] font-semibold text-[#241b06] underline underline-offset-4">
          See how it works
        </Link>
      </div>
    </section>
  );
}
