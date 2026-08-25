import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, CloudUpload, BadgeCheck, User, Users, ArrowRight } from "lucide-react";

// The front door. Everything on it is real text and real buttons rather
// than one big picture, so it stays sharp on any screen and the sign-in
// cards actually press; only the building is an image, faded into the
// page's own dark so it reads as a backdrop rather than a photo.
//
// Deliberately darker and more gold than the app inside: this is the
// shopfront, and the working screens stay light where documents are read.

// The gold-ring-and-tick mark from the artwork, drawn as its own graphic
// so it is crisp at any size and can go on letterheads later if wanted.
function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5c045" />
          <stop offset="1" stopColor="#d98a1f" />
        </linearGradient>
      </defs>
      <path d="M 51 13.5 A 24 24 0 1 0 55.5 43" fill="none" stroke="url(#lg)" strokeWidth="8" strokeLinecap="round" />
      <path d="M 26 32 L 36 42 L 56 20" fill="none" stroke="url(#lg)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="w-13 h-13 rounded-full border border-[#f0b93a]/35 bg-[#f0b93a]/5 flex items-center justify-center text-[#f0b93a]">{icon}</div>
      <div className="whitespace-pre-line text-[12px] leading-tight text-slate-200">{label}</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b111a] text-white">
      {/* The building, pinned to the top right and already faded into
          transparency on its left and bottom edges, so it works on any
          background width without a visible seam. */}
      <div className="pointer-events-none absolute top-0 right-0 h-[85vh] max-h-[990px] aspect-[423/990]">
        <Image src="/landing-building.webp" alt="" fill priority sizes="(max-width: 640px) 70vw, 480px" className="object-contain object-right-top" />
      </div>

      <div className="relative z-10 mx-auto max-w-xl px-6 pt-12 pb-10 sm:pt-16 min-h-screen flex flex-col">
        {/* Brand */}
        <LogoMark size={56} />
        <div className="mt-4 font-serif text-5xl font-medium tracking-tight">
          Cert<span className="text-[#f0b93a]">Flow</span>
        </div>
        <div className="mt-2 text-[12px] tracking-[0.35em] uppercase text-slate-400">Certification Records</div>

        <div className="mt-8 h-px w-16 bg-[#f0b93a]" />

        {/* Headline */}
        <h1 className="mt-6 text-[34px] leading-[1.15] font-bold sm:text-4xl">
          Streamline Certification.
          <br />
          <span className="text-[#f0b93a]">Stay Compliant.</span>
        </h1>
        <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-slate-300">The smart way to manage, organise and secure your certification records.</p>

        {/* Feature chips */}
        <div className="mt-9 flex items-start gap-5">
          <FeatureChip icon={<ShieldCheck size={21} />} label={"Secure &\nPrivate"} />
          <div className="mt-5 h-8 w-px bg-slate-700" />
          <FeatureChip icon={<CloudUpload size={21} />} label={"Access\nAnywhere"} />
          <div className="mt-5 h-8 w-px bg-slate-700" />
          <FeatureChip icon={<BadgeCheck size={21} />} label={"Built for\nCertifiers"} />
        </div>

        {/* Sign-in cards */}
        <div className="mt-10 space-y-4">
          <Link
            href="/login"
            className="group flex items-center gap-4 rounded-2xl bg-gradient-to-b from-[#f6c554] to-[#e8a92d] p-4 shadow-[0_8px_30px_rgba(240,185,58,0.25)] transition-transform hover:scale-[1.01]"
          >
            <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-[#181c14] text-[#f0b93a]">
              <User size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[19px] font-bold text-[#241b06]">Certifier sign in</span>
              <span className="block text-[13px] leading-snug text-[#4a3a10]">Access your dashboard and manage records</span>
            </span>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#241b06] transition-transform group-hover:translate-x-0.5">
              <ArrowRight size={19} />
            </span>
          </Link>

          <Link
            href="/client-login"
            className="group flex items-center gap-4 rounded-2xl border border-slate-700 bg-[#0e1520]/80 p-4 backdrop-blur-sm transition-colors hover:border-[#f0b93a]/50"
          >
            <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-[#131a26] text-[#f0b93a]">
              <Users size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[19px] font-bold text-white">Client portal sign in</span>
              <span className="block text-[13px] leading-snug text-slate-400">View project updates and documents</span>
            </span>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-600 text-[#f0b93a] transition-transform group-hover:translate-x-0.5">
              <ArrowRight size={19} />
            </span>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <div className="h-1 w-1 rounded-full bg-slate-600" />
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="flex items-center gap-3 text-[14px]">
            <ShieldCheck size={20} className="text-[#f0b93a]" />
            <span className="text-slate-200">
              Trusted by certifiers. <span className="text-[#f0b93a] font-semibold">Built for compliance.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
