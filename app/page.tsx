import type { Metadata } from "next";
import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  ArrowRight,
  FolderKanban,
  Users,
  HardHat,
  FileText,
  ReceiptText,
  Landmark,
  BellRing,
  ClipboardList,
  ShieldCheck,
  Sparkles,
  Archive,
  Mail,
  Check,
  Lock,
  KeyRound,
  History,
  CloudUpload,
  Scale,
  Clock,
  MapPin,
  Smartphone,
  CircleDashed,
} from "lucide-react";
import { MarketingShell, Container, Eyebrow, Section, Card, Check as Tick, CallToAction, btnPrimary, btnSecondary } from "@/components/marketing/MarketingShell";
import { DashboardMockup, PortalMockup, PortalDesktopMockup, ReminderEmailMockup, WorkflowStrip, ProductFrame } from "@/components/marketing/ProductMockups";
import { PLAN_NAME, PRICE_LABEL, PLAN_INCLUDES, OFFER_JOIN_BY, OFFER_FREE_UNTIL } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Certlyn — Building Certification. Simplified.",
  description: "The certification workflow platform for NSW private certifiers. Projects, documents, inspections, clients, invoicing and certificates in one place, from application to Occupation Certificate.",
};

// A real screenshot, when one has been put in public/screenshots. Until
// then the page shows the product drawn from its own parts. Checked at
// build time; the page is static.
function screenshot(name: string): string | null {
  return existsSync(path.join(process.cwd(), "public", "screenshots", name)) ? `/screenshots/${name}` : null;
}

// The front door. What Certlyn is in five seconds, who it is for in
// ten, how it saves time, and why it is different — then the price, and
// two ways in. Every claim on the page is something the app does today.
export default function HomePage() {
  const dashboardShot = screenshot("dashboard.png");
  const portalShot = screenshot("portal.png");

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
              The certification workflow platform for NSW private certifiers. One place for your projects, documents, inspections, clients,
              invoicing and certificates &mdash; from application to Occupation Certificate.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/join?intent=demo" className={btnPrimary}>
                Book a Demo <ArrowRight size={17} />
              </Link>
              <Link href="/join?intent=launch-offer" className={btnSecondary}>
                Start Using Certlyn
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-600">
              <li className="inline-flex items-center gap-1.5">
                <MapPin size={14} className="text-[#1f7f7a]" /> Made for NSW, CDC to OC
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Lock size={14} className="text-[#1f7f7a]" /> Your firm&rsquo;s data stays yours
              </li>
              <li className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#1f7f7a]" /> The certifier stays in control
              </li>
            </ul>
            <p className="mt-4 text-[13px] text-slate-500">
              Free until {OFFER_FREE_UNTIL} for firms that join before {OFFER_JOIN_BY}.{" "}
              <Link href="/pricing" className="font-semibold text-[#1a3a5f] hover:underline">
                See pricing
              </Link>
            </p>
          </div>
          <div className="lg:pl-4">
            <ProductFrame src={dashboardShot} alt="The Certlyn dashboard" fallback={<DashboardMockup />} />
          </div>
        </Container>
      </section>

      {/* Who it is for */}
      <section className="border-b border-slate-200 bg-white">
        <Container className="flex flex-col gap-4 py-6 text-[14px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="font-semibold text-slate-900">For private certifiers across NSW</span> &mdash; sole practitioners to multi-certifier firms
            &mdash; issuing CDCs, CCs and Occupation Certificates.
          </span>
          <span className="inline-flex items-center gap-2 text-[13px] text-slate-500">
            <Smartphone size={14} className="text-[#1f7f7a]" /> On your desk and on your phone
          </span>
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
          <Card icon={<Landmark size={20} />} title="NSW Planning Portal Workflow">
            Every inspection and certificate tracked against its Portal case, with the two-business-day reporting clock counted for you.
          </Card>
        </div>
      </Section>

      {/* Workflow */}
      <Section tone="tint" title="From application to Occupation Certificate." lead="Certlyn follows the complete lifecycle of a certification job. Each stage hands what it knows to the next, so nothing is typed twice.">
        <WorkflowStrip />
      </Section>

      {/* Time savings */}
      <Section title="Less administration. More time for certification." lead="Where the hours go on a certification job, and where Certlyn gives them back.">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_1fr] border-b border-slate-200 bg-slate-50 text-[12px] font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[1.1fr_1fr_1fr]">
            <div className="hidden px-5 py-3 sm:block">Task</div>
            <div className="px-5 py-3">Without Certlyn</div>
            <div className="px-5 py-3 text-[#1a3a5f]">With Certlyn</div>
          </div>
          {[
            ["Setting up a project", "Look up the lot, plan, council and zoning in three places and type them in.", "Type the address. The land details are looked up and offered for you to confirm."],
            ["Collecting documents", "Email the list, chase by phone, hunt through the inbox for attachments.", "The client uploads into their portal against each item. Reminders go out until it's done."],
            ["Schedule 1", "Type every document's preparer, number, revision and date by hand.", "Filled from the documents you approved. Details can be read off the title block for you to confirm."],
            ["Issuing the certificate", "Fill a template, assemble the approved set, stamp each page.", "Built from the project. The approved set is stamped and bundled behind it."],
            ["Inspections", "Notes on site, photos on the phone, the report written up that evening.", "Outcome, issues, photos, signature and Portal record, all on site before you leave."],
            ["Knowing what's outstanding", "Open each project and read down the checklist.", "One panel per project, one note each morning: what arrived, what's waiting, what's due."],
          ].map(([task, before, after]) => (
            <div key={task} className="grid grid-cols-[1fr_1fr] border-b border-slate-100 text-[14px] last:border-b-0 sm:grid-cols-[1.1fr_1fr_1fr]">
              <div className="col-span-2 border-b border-slate-100 px-5 pt-3 pb-1 font-semibold text-slate-900 sm:col-span-1 sm:border-b-0 sm:py-4">{task}</div>
              <div className="px-5 py-3 text-slate-500 sm:py-4">{before}</div>
              <div className="px-5 py-3 text-slate-800 sm:py-4">
                <span className="inline-flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-[#1f7f7a]" /> {after}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:items-start">
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
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow>Client portal</Eyebrow>
              <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-[#1a3a5f] sm:text-4xl">Give your clients their own portal.</h2>
              <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-slate-600">
                Clients securely access their project, upload requested information, see outstanding items, receive notifications and stay
                informed about progress. They see what you choose to share, and nothing you don&rsquo;t.
              </p>
              <ul className="mt-6 space-y-3">
                <Tick>Upload against each requested document, from a phone or a desk.</Tick>
                <Tick>See which documents are approved, being reviewed, sent back, or still needed &mdash; with your note beside each.</Tick>
                <Tick>Book inspections, and see them confirmed.</Tick>
                <Tick>View and pay invoices by card.</Tick>
                <Tick>Reminded automatically while anything is outstanding, in your firm&rsquo;s name.</Tick>
              </ul>
              <Link href="/how-it-works" className={`${btnSecondary} mt-8`}>
                See how the client portal works <ArrowRight size={16} />
              </Link>
            </div>
            <div className="rise-in-late">
              <PortalMockup />
            </div>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <ProductFrame src={portalShot} alt="The client portal" fallback={<PortalDesktopMockup />} />
            <ReminderEmailMockup />
          </div>
        </Container>
      </section>

      {/* Automation */}
      <Section title="Built to remove the repetitive work." lead="The parts of the job that are the same every time, done the same way every time. Nothing is sent without a person pressing Send.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [BellRing, "Automated notifications", "Document and invoice reminders on a schedule you set, stopped the moment you're in touch."],
            [ClipboardList, "Document requests and tracking", "Checklists from your own library, per stage, with every version kept."],
            [HardHat, "Inspection workflow", "Book, confirm, carry out, sign, report — one card per inspection."],
            [ShieldCheck, "Approval workflow", "Approve, send back with a note, or reopen. Schedule 1 follows."],
            [FileText, "Certificate generation support", "CDC, CC and OC built from the project, in your wording and layout."],
            [Mail, "Client communication", "Portal invitations, updates and reports, sent in your firm's name."],
            [ReceiptText, "Invoicing", "From the quote or the job; paid by card; chased when overdue."],
            [Archive, "Centralised project records", "Every certificate version, signed report and email, on an audit log nobody can edit."],
          ].map(([Icon, label, text]) => {
            const I = Icon as typeof BellRing;
            return (
              <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-[#1f7f7a]">
                  <I size={16} />
                </span>
                <div className="mt-3 text-[15px] font-semibold text-slate-900">{label as string}</div>
                <p className="mt-1 text-[13px] leading-snug text-slate-600">{text as string}</p>
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

      {/* Planning Portal */}
      <Section tone="tint" title="The NSW Planning Portal, without the double handling." lead="What Certlyn does with the Portal today, and what is still in onboarding — stated plainly.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[#1f7f7a]">
              <Check size={16} /> Available today
            </div>
            <ul className="mt-4 space-y-3">
              <Tick>The Portal case reference kept on every inspection and certificate, so nothing is reported against the wrong case.</Tick>
              <Tick>The two-business-day reporting window counted in NSW business days, shown on the inspection and on the compliance clock.</Tick>
              <Tick>One click records that an inspection or certificate has been reported, with the date, and the record follows the job.</Tick>
              <Tick>Unreported inspections flagged on the dashboard and in your morning note until they are done.</Tick>
            </ul>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
              <CircleDashed size={16} /> In onboarding
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
              Direct submission of inspection and certificate reports through the Portal&rsquo;s certifier API is built and tested against the
              department&rsquo;s test environment. It switches on for a firm once the department completes that firm&rsquo;s API onboarding.
              Until then, reporting is one click in Certlyn and the same details entered in the Portal.
            </p>
          </div>
        </div>
      </Section>

      {/* Security and trust */}
      <Section title="Security and professional trust, built in." lead="A certifier's file has to stand up years later. Certlyn is built as if someone will ask.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card icon={<Lock size={20} />} title="Each firm walled off">
            Every firm&rsquo;s projects, documents and settings are separated from every other firm&rsquo;s by rules enforced in the database
            itself, not only by the screens.
          </Card>
          <Card icon={<KeyRound size={20} />} title="Two-factor sign-in">
            An authenticator app on the certifier&rsquo;s phone, asked for at every sign-in. A stolen password on its own opens nothing.
          </Card>
          <Card icon={<History size={20} />} title="A record nobody can edit">
            Every certificate version, every signed report, every email sent &mdash; and the ones that failed &mdash; on an append-only audit
            log.
          </Card>
          <Card icon={<CloudUpload size={20} />} title="Backups to your own cloud">
            Nightly copies of your projects can go to your own Dropbox or OneDrive. Your data, in your account, whatever happens to ours.
          </Card>
          <Card icon={<Scale size={20} />} title="The certifier decides">
            No document is accepted, no certificate issued and nothing reported without the registered certifier acting. AI only ever
            suggests.
          </Card>
          <Card icon={<Clock size={20} />} title="Deadlines you can see">
            Portal windows, CDC lapse dates, notification periods, registration and insurance renewals, on one screen, in order of
            consequence.
          </Card>
        </div>
      </Section>

      {/* Why different */}
      <Section tone="tint" title="More than reporting. More than project software." lead="Certlyn brings your certification workflow, client communication, documents, inspections and invoicing together in one platform.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">A reporting tool</div>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">Does one thing: tells the Portal what you did. Everything before and after it still lives in email, folders and spreadsheets.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">Generic project software</div>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">Knows nothing of a CDC, a Schedule 1, a critical stage inspection or a two-business-day window. You build it all yourself, and maintain it.</p>
          </div>
          <div className="rounded-2xl border-2 border-[#1a3a5f] bg-white p-6 shadow-sm">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-[#1a3a5f]">Certlyn</div>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
              Built for the NSW certification workflow, stage by stage, with the client, the documents, the inspections, the certificates and
              the invoicing already in it. Shaped by feedback from certifiers across NSW.
            </p>
          </div>
        </div>
      </Section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-20">
        <Container>
          <div className="max-w-3xl">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-[#1a3a5f] sm:text-4xl">One powerful platform. One simple price.</h2>
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
              <Link href="/pricing" className="mt-6 inline-flex items-center gap-1 text-[14px] font-semibold text-[#1a3a5f] hover:underline">
                Full pricing details <ArrowRight size={14} />
              </Link>
            </div>
            <div className="rounded-3xl bg-[#1a3a5f] p-8 text-white">
              <div className="inline-flex items-center rounded-full bg-[#f0b93a] px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-[#241b06]">Launch offer</div>
              <div className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[34px]">Free until {OFFER_FREE_UNTIL}</div>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-200">
                Join Certlyn before {OFFER_JOIN_BY} and use the platform at no subscription cost until {OFFER_FREE_UNTIL}.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-300">After {OFFER_FREE_UNTIL}, the standard subscription is {PRICE_LABEL} per month.</p>
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
