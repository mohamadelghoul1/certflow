import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";

// The frame around the public site — the pages a certifier reads before
// they have a login. Light, spacious, and in the app's own colours:
// navy for headings, teal for marks, gold for the one button on each
// screen that matters. The sign-in pages keep their darker treatment;
// this is the shopfront, and it should read in daylight.

export const NAV = [
  { href: "/how-it-works", label: "Product" },
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/join", label: "Contact" },
];

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#f6c554] to-[#e8a92d] px-6 py-3 text-[15px] font-bold text-[#241b06] shadow-[0_6px_20px_rgba(240,185,58,0.28)] transition hover:brightness-[1.03] hover:shadow-[0_8px_26px_rgba(240,185,58,0.36)]";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold text-[#1a3a5f] transition hover:border-[#1a3a5f]/50 hover:bg-slate-50";
export const btnSmall = "inline-flex items-center gap-1.5 rounded-full bg-[#1a3a5f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#244a73]";

export function MarketingShell({ current, children }: { current: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-700">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={28} id="certlyn-nav-gold" />
            <span className="font-serif text-2xl font-medium tracking-tight text-[#1a3a5f]">
              Cert<span className="text-[#d99a12]">lyn</span>
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-[14px] md:flex">
            {NAV.map((page) => (
              <Link key={page.href} href={page.href} className={page.href === current ? "font-semibold text-[#1a3a5f]" : "text-slate-600 hover:text-[#1a3a5f]"}>
                {page.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/login" className="hidden text-[14px] font-semibold text-[#1a3a5f] hover:underline sm:inline">
              Sign in
            </Link>
            <Link href="/join?intent=demo" className={btnSmall}>
              Book a demo <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <nav className="flex items-center gap-5 overflow-x-auto px-6 pb-3 text-[13px] md:hidden">
          {NAV.map((page) => (
            <Link key={page.href} href={page.href} className={`whitespace-nowrap ${page.href === current ? "font-semibold text-[#1a3a5f]" : "text-slate-600"}`}>
              {page.label}
            </Link>
          ))}
          <Link href="/login" className="whitespace-nowrap font-semibold text-[#1a3a5f] sm:hidden">
            Sign in
          </Link>
        </nav>
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark size={26} id="certlyn-footer-gold" />
              <span className="font-serif text-xl font-medium tracking-tight text-[#1a3a5f]">
                Cert<span className="text-[#d99a12]">lyn</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-slate-600">Professional certification workflow software for NSW building certifiers.</p>
          </div>
          <FooterColumn
            title="Product"
            links={[
              { href: "/how-it-works", label: "How it works" },
              { href: "/#features", label: "Features" },
              { href: "/why-certlyn", label: "Why Certlyn" },
              { href: "/pricing", label: "Pricing" },
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              { href: "/join?intent=demo", label: "Book a demo" },
              { href: "/join", label: "Contact" },
              { href: "/privacy", label: "Privacy policy" },
              { href: "/terms", label: "Terms of use" },
            ]}
          />
          <FooterColumn
            title="Sign in"
            links={[
              { href: "/login", label: "Certifier login" },
              { href: "/client-login", label: "Client portal" },
            ]}
          />
        </div>
        <div className="border-t border-slate-200">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-[12px] text-slate-500 sm:flex-row sm:items-center">
            <span>Built for NSW building certifiers.</span>
            <span className="sm:ml-auto">Prices in Australian dollars, excluding GST.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <ul className="mt-3 space-y-2 text-[14px]">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link href={link.href} className="text-slate-700 hover:text-[#1a3a5f] hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The pieces the pages are laid out from, so they read as one set.

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-6 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#1f7f7a]">{children}</div>;
}

export function Hero({ kicker, title, children }: { kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
      <Container className="pt-16 pb-14 sm:pt-20">
        <Eyebrow>{kicker}</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-[34px] font-bold leading-[1.12] tracking-tight text-[#1a3a5f] sm:text-5xl">{title}</h1>
        {children && <div className="mt-5 max-w-2xl text-[17px] leading-relaxed text-slate-600">{children}</div>}
      </Container>
    </section>
  );
}

export function Section({ title, lead, children, id, tone = "white" }: { title: string; lead?: string; children: React.ReactNode; id?: string; tone?: "white" | "tint" }) {
  return (
    <section id={id} className={`py-16 sm:py-20 ${tone === "tint" ? "bg-slate-50 border-y border-slate-200" : "bg-white"}`}>
      <Container>
        <h2 className="max-w-3xl text-[28px] font-bold leading-tight tracking-tight text-[#1a3a5f] sm:text-4xl">{title}</h2>
        {lead && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-slate-600">{lead}</p>}
        <div className="mt-10">{children}</div>
      </Container>
    </section>
  );
}

export function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-[#1f7f7a]">{icon}</div>
      <h3 className="mt-4 text-[18px] font-bold text-slate-900">{title}</h3>
      <div className="mt-2 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </div>
  );
}

export function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-16">
      <span className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#1a3a5f] text-[17px] font-bold text-white">{number}</span>
      <h3 className="pt-2 text-[20px] font-bold text-slate-900">{title}</h3>
      <div className="mt-2 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </li>
  );
}

export function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] leading-relaxed text-slate-700">
      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[#1f7f7a]">
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 6.5 4.8 9 10 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

export function CallToAction({
  title,
  blurb,
  primary = { href: "/join?intent=demo", label: "Book a demo" },
  secondary = { href: "/pricing", label: "See pricing" },
}: {
  title: string;
  blurb: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div className="rounded-3xl bg-[#1a3a5f] px-7 py-10 text-white sm:px-12 sm:py-14">
          <h2 className="max-w-2xl text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">{title}</h2>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-slate-200">{blurb}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={primary.href} className={btnPrimary}>
              {primary.label} <ArrowRight size={17} />
            </Link>
            <Link href={secondary.href} className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-[15px] font-semibold text-white hover:bg-white/10">
              {secondary.label}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
