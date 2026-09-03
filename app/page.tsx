import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FolderKanban, Users, HardHat, FileText, ReceiptText, Landmark, BellRing, ClipboardList, ShieldCheck, Sparkles, Archive, Mail, Check } from "lucide-react";
import { MarketingShell, Container, Eyebrow, Section, Card, Check as Tick, CallToAction, btnPrimary, btnSecondary } from "@/components/marketing/MarketingShell";
import { DashboardMockup, PortalMockup, WorkflowStrip } from "@/components/marketing/ProductMockups";
import { PLAN_NAME, PRICE_LABEL, PLAN_INCLUDES, OFFER_JOIN_BY, OFFER_FREE_UNTIL } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Certlyn — Building Certification. Simplified.",
  description: "One platform to manage your certification projects from application to Occupation Certificate. Built for NSW building certifiers.",
};

// The front door. What Certlyn is in five seconds, who it is for in
// ten, and the price without hunting. Every claim on the page is
// something the app does today.
export default function HomePage() {
  return (
    <MarketingShell current="/">
      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <Container className="grid items-center gap-12 pt-16 pb-16 lg:grid-cols-[1fr_1.05fr] lg:pt-20">
          <div className="rise-in">
            <Eyebrow>Built for NSW building certifiers</Eyebrow>
            <h1 className="mt-4 text-[40px] font-bold leading-[1.08] tracking-tight text-[#1a3a5f] sm:text-[56px]">
              Building Certification.
              <br />
              <span className="text-[#d99a12]">Simplified.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[18px] leading-relaxed text-slate-600">
              One platform to manage your certification projects from application to Occupation Certificate.
            </p>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-slate-500">
              Manage your certification projects, documents, inspections, clients, invoicing and certificates in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/join?intent=demo" className={btnPrimary}>
                Book a Demo <ArrowRight size={17} />
              </Link>
              <Link href="/join?intent=launch-offer" className={btnSecondary}>
                Start Using Certlyn
              </Link>
            </div>
            <p className="mt-5 inline-flex items-center gap-2 text-[13px] text-slate-500">
              <ShieldCheck size={15} className="text-[#1f7f7a]" /> Free until {OFFER_FREE_UNTIL} for firms that join before {OFFER_JOIN_BY}.
              <Link href="/pricing" className="font-semibold text-[#1a3a5f] hover:underline">
                See pricing
              </Link>
            </p>
          </div>
          <div className="lg:pl-4">
            <DashboardMockup />
          </div>
        </Container>
      </section>

      {/* Value proposition */}
      <Section id="features" title="Everything you need to run certification — in one platform." lead="Not a document store. Not a reporting tool. The whole job, from the first phone call to the Occupation Certificate.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card icon={<FolderKanban size={20} />} title="Project Management">
            Track every job from application through to Occupation Certificate, with every stage, document and date on one page.
          </Card>
          <Card icon={<Users size={20} />} title="Client Portal">
            Give clients one secure place to upload documents, view requests, follow progress and receive updates.
          </Card>
          <Card icon={<HardHat size={20} />} title="Inspections">
            Manage inspection stages, records, notices and outcomes without scattered emails and spreadsheets. Carried out from a phone.
          </Card>
          <Card icon={<FileText size={20} />} title="Documents & Certificates">
            Keep project documentation organised and accessible throughout the job. Certificates built from the project, stamped sets behind
            them.
          </Card>
          <Card icon={<ReceiptText size={20} />} title="Invoicing">
            Manage job-related invoicing within the same workflow. Clients pay by card from their portal.
          </Card>
          <Card icon={<Landmark size={20} />} title="NSW Planning Portal Integration">
            Support the required reporting workflow without duplicating administration, with the two-day clock counted for you.
          </Card>
        </div>
      </Section>

      {/* Workflow */}
      <Section tone="tint" title="From application to Occupation Certificate." lead="Certlyn follows the complete lifecycle of a certification job. Each stage hands what it knows to the next.">
        <WorkflowStrip />
      </Section>

      {/* Certifier-focused */}
      <Section title="Less administration. More time for certification.">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <ul className="space-y-3">
            <Tick>Keep project information in one place.</Tick>
            <Tick>Reduce repetitive client emails and document chasing.</Tick>
            <Tick>See what is outstanding before an inspection.</Tick>
            <Tick>Keep inspection and certification records organised.</Tick>
            <Tick>Automate routine notifications and workflow updates.</Tick>
            <Tick>Give clients visibility without giving up certifier control.</Tick>
          </ul>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[#1a3a5f]">
              <ShieldCheck size={16} className="text-[#1f7f7a]" /> Your judgement stays yours
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              Certlyn assists certifiers with administration and workflow. It does not replace the certifier&rsquo;s professional assessment or
              decision-making. What a project requires, whether a document is acceptable, whether a certificate is issued: those decisions are
              made by the registered certifier, and the platform is built so they can&rsquo;t be made anywhere else.
            </p>
          </div>
        </div>
      </Section>

      {/* Client portal */}
      <section className="border-y border-slate-200 bg-slate-50 py-16 sm:py-20">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Client portal</Eyebrow>
            <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-[#1a3a5f] sm:text-4xl">Give your clients their own portal.</h2>
            <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-slate-600">
              Clients securely access their project, upload requested information, see outstanding items, receive notifications and stay
              informed about progress. They see what you choose to share, and nothing you don&rsquo;t.
            </p>
            <ul className="mt-6 space-y-3">
              <Tick>Upload against each requested document, straight from a phone.</Tick>
              <Tick>See which documents are approved, being reviewed, or still needed.</Tick>
              <Tick>Book inspections, and see them confirmed.</Tick>
              <Tick>View and pay invoices by card.</Tick>
            </ul>
            <Link href="/how-it-works" className={`${btnSecondary} mt-8`}>
              See how the client portal works <ArrowRight size={16} />
            </Link>
          </div>
          <div className="rise-in-late">
            <PortalMockup />
          </div>
        </Container>
      </section>

      {/* Automation */}
      <Section title="Built to remove the repetitive work." lead="The parts of the job that are the same every time, done the same way every time. Nothing is sent without a person pressing Send.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [BellRing, "Automated notifications"],
            [ClipboardList, "Document requests and tracking"],
            [HardHat, "Inspection workflow"],
            [ShieldCheck, "Approval workflow"],
            [FileText, "Certificate generation support"],
            [Mail, "Client communication"],
            [ReceiptText, "Invoicing"],
            [Archive, "Centralised project records"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof BellRing;
            return (
              <div key={label as string} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[#1f7f7a]">
                  <I size={16} />
                </span>
                <span className="text-[15px] font-semibold text-slate-800">{label as string}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-6 inline-flex items-start gap-2 text-[13px] text-slate-500">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-[#1f7f7a]" />
          Where AI is used, it drafts notes and reads document details for a person to confirm. It never performs statutory assessment or makes
          certification decisions.
        </p>
      </Section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-slate-200 bg-slate-50 py-16 sm:py-20">
        <Container>
          <div className="max-w-3xl">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-[#1a3a5f] sm:text-4xl">One powerful platform. One simple price.</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-slate-600">
              More than reporting. Certlyn brings your certification workflow, client communication, documents, inspections and invoicing
              together in one platform.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-500">{PLAN_NAME}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[44px] font-bold leading-none tracking-tight text-[#1a3a5f]">{PRICE_LABEL}</span>
                <span className="text-[15px] text-slate-500">/ month</span>
              </div>
              <div className="mt-1 text-[13px] text-slate-500">One subscription for your firm. Cancel any time.</div>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {PLAN_INCLUDES.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[14px] text-slate-700">
                    <Check size={15} className="shrink-0 text-[#1f7f7a]" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-[#1a3a5f] p-8 text-white">
              <div className="inline-flex items-center rounded-full bg-[#f0b93a] px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-[#241b06]">Launch offer</div>
              <div className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[34px]">
                Free until {OFFER_FREE_UNTIL}
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-200">
                Join Certlyn before {OFFER_JOIN_BY} and use the platform at no subscription cost until {OFFER_FREE_UNTIL}.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-300">
                After {OFFER_FREE_UNTIL}, the standard subscription is {PRICE_LABEL} per month.
              </p>
              <Link href="/join?intent=launch-offer" className={`${btnPrimary} mt-7`}>
                Claim the Launch Offer <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <CallToAction
        title="Ready to simplify your certification workflow?"
        blurb="See how Certlyn can bring your certification jobs, clients and administration together in one place."
        primary={{ href: "/join?intent=demo", label: "Book a Demo" }}
        secondary={{ href: "/join?intent=launch-offer", label: "Claim the Launch Offer" }}
      />
    </MarketingShell>
  );
}
