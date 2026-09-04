import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, HelpCircle } from "lucide-react";
import { MarketingShell, Container, Eyebrow, Section, CallToAction, btnPrimary, btnSecondary } from "@/components/marketing/MarketingShell";
import { PLAN_NAME, PRICE_LABEL, PLAN_INCLUDES, OFFER_JOIN_BY, OFFER_FREE_UNTIL, COVERAGE_LINE, JOBS_PER_MONTH } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing — Certlyn",
  description: `${PLAN_NAME}: ${PRICE_LABEL} per month. Free until ${OFFER_FREE_UNTIL} for firms that join before ${OFFER_JOIN_BY}.`,
};

const QUESTIONS: { q: string; a: string }[] = [
  {
    q: "What does the launch offer include?",
    a: `Everything in ${PLAN_NAME}, with no subscription cost until ${OFFER_FREE_UNTIL}, for any firm that joins before ${OFFER_JOIN_BY}. From 1 July 2027 the standard ${PRICE_LABEL} per month applies. There is nothing to pay up front.`,
  },
  {
    q: "Is the price per firm or per certifier?",
    a: "Per firm, with unlimited certifiers. One subscription covers your practice, every certifier in it, and your clients' portal access.",
  },
  {
    q: `What does "up to ${JOBS_PER_MONTH} new projects a month" mean?`,
    a: `The subscription covers up to ${JOBS_PER_MONTH} new projects created in a calendar month — a project being one application, whatever certificates and inspections it goes on to need. Projects already under way don't count again. If your firm regularly opens more than ${JOBS_PER_MONTH} a month, talk to us about a larger plan.`,
  },
  {
    q: "Is there a setup fee?",
    a: "No. We set your firm up with you and bring your current projects across from a spreadsheet at no charge.",
  },
  {
    q: "Are there any other costs?",
    a: "Card payments through the portal carry Stripe's processing fee, which you can pass to the client as a surcharge or absorb. The optional AI features use a small amount of usage-based credit, typically a few cents per note. Everything else is included.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, at any time, effective at the end of the billing period. You keep thirty days to export your records.",
  },
  {
    q: "Is GST included?",
    a: "Prices are in Australian dollars and exclude GST, which is added on the invoice.",
  },
];

export default function PricingPage() {
  return (
    <MarketingShell current="/pricing">
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <Container className="pt-16 pb-14 sm:pt-20">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-[34px] font-bold leading-[1.12] tracking-tight text-[#1a3a5f] sm:text-5xl">One powerful platform. One simple price.</h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-slate-600">
            More than reporting. Certlyn brings your certification workflow, client communication, documents, inspections and invoicing together
            in one platform &mdash; for the price of a basic reporting tool.
          </p>
        </Container>
      </section>

      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
              <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-500">{PLAN_NAME}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[52px] font-bold leading-none tracking-tight text-[#1a3a5f]">{PRICE_LABEL}</span>
                <span className="text-[16px] text-slate-500">/ month</span>
              </div>
              <div className="mt-2 text-[14px] text-slate-500">One subscription for your firm. {COVERAGE_LINE} No setup fee. Cancel any time.</div>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {PLAN_INCLUDES.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-[15px] text-slate-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[#1f7f7a]">
                      <Check size={12} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/join?intent=demo" className={btnSecondary}>
                  Book a Demo
                </Link>
              </div>
            </div>

            <div className="rounded-3xl bg-[#1a3a5f] p-8 text-white sm:p-10">
              <div className="inline-flex items-center rounded-full bg-[#f0b93a] px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-[#241b06]">Launch offer</div>
              <div className="mt-5 text-[13px] font-semibold uppercase tracking-[0.2em] text-slate-300">Free until</div>
              <div className="text-[34px] font-bold leading-tight tracking-tight sm:text-[40px]">{OFFER_FREE_UNTIL}</div>
              <p className="mt-4 text-[16px] leading-relaxed text-slate-100">
                Join Certlyn before <span className="font-semibold text-white">{OFFER_JOIN_BY}</span> and use the platform at no subscription cost
                until <span className="font-semibold text-white">{OFFER_FREE_UNTIL}</span>.
              </p>
              <div className="mt-5 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-[14px] leading-relaxed text-slate-200">
                After {OFFER_FREE_UNTIL}, the standard subscription is <span className="font-semibold text-white">{PRICE_LABEL} per month</span>. No
                lock-in, no catch: you can leave before then and owe nothing.
              </div>
              <Link href="/join?intent=launch-offer" className={`${btnPrimary} mt-7`}>
                Claim the Launch Offer <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <Section tone="tint" title="Why the same price buys a lot more." lead="A basic reporting platform costs about this much a month and does one thing. Certlyn does that, and the rest of the job.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[12px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-semibold">What you get</th>
                <th className="px-5 py-3 font-semibold">A basic reporting tool</th>
                <th className="px-5 py-3 font-semibold text-[#1a3a5f]">Certlyn</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["NSW Planning Portal reporting workflow", true, true],
                ["Project management from application to OC", false, true],
                ["Client portal with document upload and requests", false, true],
                ["Inspection management, on site from a phone", false, true],
                ["Certificate generation and approved-set bundling", false, true],
                ["Invoicing and card payments", false, true],
                ["Automated document and invoice reminders", false, true],
                ["Compliance clock and audit record", false, true],
              ].map(([label, basic, certlyn]) => (
                <tr key={label as string} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-5 py-3 text-slate-700">{label as string}</td>
                  <td className="px-5 py-3">{basic ? <Check size={16} className="text-slate-400" /> : <span className="text-slate-300">&mdash;</span>}</td>
                  <td className="px-5 py-3">{certlyn ? <Check size={16} className="text-[#1f7f7a]" /> : <span className="text-slate-300">&mdash;</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Questions about pricing">
        <dl className="grid gap-5 md:grid-cols-2">
          {QUESTIONS.map((item) => (
            <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <dt className="flex items-start gap-2 text-[16px] font-bold text-slate-900">
                <HelpCircle size={18} className="mt-0.5 shrink-0 text-[#1f7f7a]" /> {item.q}
              </dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-slate-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <CallToAction
        title="Ready to simplify your certification workflow?"
        blurb="See how Certlyn can bring your certification jobs, clients and administration together in one place."
        primary={{ href: "/join?intent=demo", label: "Book a Demo" }}
        secondary={{ href: "/join?intent=launch-offer", label: "Claim the Launch Offer" }}
      />
    </MarketingShell>
  );
}
