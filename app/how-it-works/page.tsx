import type { Metadata } from "next";
import { FileText, Smartphone, Sparkles, Landmark, ReceiptText, ShieldCheck, Users, ClipboardCheck } from "lucide-react";
import { MarketingShell, Hero, Section, Step, Card, CallToAction } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "How Certlyn works",
  description: "From quote to Occupation Certificate: how a NSW building certifier runs a project through Certlyn.",
};

// The working day, in the order it happens. Every claim on this page is
// something the app does today — nothing here is a roadmap.
export default function HowItWorksPage() {
  return (
    <MarketingShell current="/how-it-works">
      <Hero kicker="Product" title={<>From quote to Occupation Certificate, <span className="text-[#d99a12]">in one place.</span></>}>
        Certlyn follows a project the way NSW certifiers told us they run one: quote it, collect the documents, issue the certificate,
        inspect the work, issue the OC. Each step hands what it knows to the next, so nothing is typed twice.
      </Hero>

      <Section title="A project, step by step">
        <ol className="space-y-10">
          <Step number={1} title="Quote it">
            Build a priced quote in a couple of minutes: the address, the works, the services, your fee. Send it as a PDF. When it&rsquo;s
            accepted, one press turns it into a project with everything already filled in.
          </Step>
          <Step number={2} title="Set up the project">
            Type the address and Certlyn looks up the lot and plan, the council, and the planning layers &mdash; zone, lot area, heritage,
            bushfire &mdash; for you to confirm. The document checklists for each stage come from your own library. Your client gets a portal
            login.
          </Step>
          <Step number={3} title="Collect the documents">
            The client uploads straight into their portal against each item. Certlyn reminds them automatically while anything is
            outstanding, and stops the moment you&rsquo;ve been in touch. You review, send back with a note, or approve. Schedule 1 fills
            itself from the documents you approved.
          </Step>
          <Step number={4} title="Issue the certificate">
            The CDC or CC is built from the project: the applicant, the land, the consent, the conditions you tick, your registration and
            signature. The approved set is stamped and bundled behind it. Every version is kept, and the neighbour-notification period is
            counted for you.
          </Step>
          <Step number={5} title="Inspect from your phone">
            <span className="font-semibold text-slate-900">On site</span> is the inspection as one thumb-sized screen: directions, call the site,
            what you found, issues, photos straight from the camera, notes. Sign the report standing on the slab, report it to the NSW
            Planning Portal, email the client if you want to.
          </Step>
          <Step number={6} title="Issue the OC">
            Whole or partial. The Occupation Certificate goes out with every inspection report behind it, numbered against the CDC or CC
            it completes.
          </Step>
        </ol>
      </Section>

      <Section title="Around the project" lead="The parts of a practice that aren't a single project, kept in the same place.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card icon={<Sparkles size={20} />} title="An assistant that reads your day">
            Open Certlyn and a short note tells you who uploaded what and when, what&rsquo;s waiting on you to assess, what&rsquo;s booked,
            what&rsquo;s due. It writes only from what the app knows &mdash; it never invents a fact.
          </Card>
          <Card icon={<ClipboardCheck size={20} />} title="A compliance clock">
            Every deadline on one screen: the Portal&rsquo;s two-day reporting window, CDC lapse dates, notification periods, your
            registration and PI insurance, overdue invoices.
          </Card>
          <Card icon={<ReceiptText size={20} />} title="Invoices, paid online">
            Invoice from the quote or the job. Clients pay by card from their portal. Overdue invoices are chased for you, and what&rsquo;s
            owed is on the dashboard.
          </Card>
          <Card icon={<Landmark size={20} />} title="The NSW Planning Portal">
            Inspections and certificates are reported against the right case, with the two-day clock counted in business days. Direct
            reporting through the Portal&rsquo;s API is built in, ready for when the department switches it on for your firm.
          </Card>
          <Card icon={<ShieldCheck size={20} />} title="A record that stands up">
            An append-only audit log, every certificate version, every signed report, every email that went out &mdash; and the ones that
            didn&rsquo;t. Nothing is quietly overwritten.
          </Card>
          <Card icon={<Users size={20} />} title="Your whole team">
            Several certifiers under one firm, each with their own registration, signature and Portal login. Contract certifiers included.
          </Card>
          <Card icon={<FileText size={20} />} title="Your own wording and letterhead">
            Certificates, letters and reports carry your logo, your wording and your layout. Change them once and every project follows.
          </Card>
          <Card icon={<Smartphone size={20} />} title="On your phone, on your desk">
            The same Certlyn on both. Install it to a phone&rsquo;s home screen and it opens like an app.
          </Card>
        </div>
      </Section>

      <CallToAction title="Bring your projects across in an afternoon." blurb="Fill in one spreadsheet, drop it on the Import page, and every job under construction is in Certlyn with its approval recorded, ready for inspections and the OC." primary={{ href: "/join?intent=demo", label: "Book a Demo" }} secondary={{ href: "/join?intent=launch-offer", label: "Claim the Launch Offer" }} />
    </MarketingShell>
  );
}
