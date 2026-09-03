"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Lock, FileCheck2, Eye, EyeOff } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";

// The frame both sign-in pages sit in: the same dark, gold-lined
// shopfront as the front door, so arriving here from it feels like
// walking further in rather than into a different building.
//
// Wide screens get the brand on the left and the form on the right; a
// phone stacks them, brand first but short, so the email box is on the
// first screen without scrolling.

const TRUST = [
  { icon: Lock, text: "Your records stay yours — every firm's data is walled off from every other." },
  { icon: FileCheck2, text: "Certificates, inspections and the Portal, in one place." },
  { icon: ShieldCheck, text: "Built for NSW building certifiers." },
];

export function AuthShell({ kicker, title, blurb, children, footer }: { kicker: string; title: string; blurb: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b111a] text-white">
      <div className="pointer-events-none absolute top-0 right-0 h-[60vh] max-h-[990px] aspect-[423/990] opacity-70 sm:opacity-100 sm:h-[85vh]">
        <Image src="/landing-building.webp" alt="" fill priority sizes="(max-width: 640px) 60vw, 480px" className="object-contain object-right-top" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-10 pb-8 sm:pt-14 min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col lg:flex-row lg:items-center lg:gap-16">
          <div className="lg:flex-1">
            <Link href="/" className="inline-flex items-center gap-3">
              <LogoMark size={44} />
              <span className="font-serif text-4xl font-medium tracking-tight">
                Cert<span className="text-[#f0b93a]">lyn</span>
              </span>
            </Link>
            <div className="mt-2 text-[11px] tracking-[0.35em] uppercase text-slate-400">{kicker}</div>
            <div className="mt-6 h-px w-16 bg-[#f0b93a]" />
            <h1 className="mt-5 text-[30px] leading-tight font-bold sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-slate-300">{blurb}</p>

            <ul className="mt-8 hidden space-y-3 lg:block">
              {TRUST.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-[14px] text-slate-300">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#f0b93a]/35 bg-[#f0b93a]/5 text-[#f0b93a]">
                    <Icon size={14} />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 w-full lg:mt-0 lg:w-[420px] lg:shrink-0">{children}</div>
        </div>

        <div className="mt-10 flex items-center gap-3 text-[13px] text-slate-400">
          <ShieldCheck size={16} className="text-[#f0b93a]" />
          <span>
            Trusted by certifiers. <span className="font-semibold text-[#f0b93a]">Built for compliance.</span>
          </span>
          <span className="ml-auto">{footer}</span>
        </div>
      </div>
    </div>
  );
}

export function AuthCard({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-[#0e1520]/85 backdrop-blur-sm shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
      <div className="px-7 pt-6 pb-2 text-[11px] font-semibold tracking-[0.25em] uppercase text-[#f0b93a]">{heading}</div>
      <div className="px-7 pb-7">{children}</div>
    </div>
  );
}

export const authInputCls =
  "w-full px-3.5 py-3 rounded-xl bg-[#131a26] border border-slate-700 text-white text-[15px] placeholder:text-slate-500 outline-none focus:border-[#f0b93a]/70 focus:ring-2 focus:ring-[#f0b93a]/25";
export const authLabelCls = "block text-xs font-semibold text-slate-300 mb-1.5";
export const authButtonCls =
  "w-full py-3 rounded-xl bg-gradient-to-b from-[#f6c554] to-[#e8a92d] text-[#241b06] font-bold text-[15px] shadow-[0_8px_30px_rgba(240,185,58,0.25)] transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100";

// The password box with a way to see what was typed. A phone keyboard
// mistypes one character in ten; a box that cannot be checked makes
// every one of those a second attempt.
export function PasswordField({ name = "password", autoComplete = "current-password" }: { name?: string; autoComplete?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input name={name} type={shown ? "text" : "password"} required autoComplete={autoComplete} className={`${authInputCls} pr-11`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-white"
      >
        {shown ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
