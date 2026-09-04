import type { Metadata } from "next";
import { Clock, Keyboard, BellRing, Scale, Lock, HardHat } from "lucide-react";
import { MarketingShell, Hero, Section, Card, CallToAction } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Why Certlyn",
  description: "What a NSW building certifier gets back from running their practice on Certlyn.",
};

// The case for it, made in the terms a certifier weighs things in:
// hours, deadlines, phone calls, and what stands up when someone asks
// for the file. Plain statements about what the app does; no numbers
// nobody has measured.
export default function WhyCertlynPage() {
  return (
    <MarketingShell current="/why-certlyn">
      <Hero kicker="Why Certlyn" title={<>Less typing. Fewer missed deadlines. <span className="text-[#d99a12]">A file that stands up.</span></>}>
        Most certification software was written for someone else and adapted. Certlyn was shaped by feedback from certifiers across NSW
        &mdash; what slows them down, what gets missed, what they wish the last system had done &mdash; and built around the work as it
        is: the Regulation, the Portal, the builder on the phone, the client who hasn&rsquo;t sent the BASIX certificate.
      </Hero>

      <Section title="What you get back">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card icon={<Keyboard size={20} />} title="Hours of typing">
            The address fills in the lot, plan, council and zone. The quote fills in the project. The approved documents fill in Schedule
            1 &mdash; and the AI reads each title block so you confirm details rather than type them. The certificate is built from the
            project, not from a blank template.
          </Card>
          <Card icon={<Clock size={20} />} title="Deadlines you can see coming">
            The Portal&rsquo;s two-business-day reporting window, a CDC&rsquo;s five-year lapse, a neighbour-notification period, your PI
            insurance renewal &mdash; on one screen, in order of how much trouble they&rsquo;d cause, each linking to the place it gets fixed.
          </Card>
          <Card icon={<BellRing size={20} />} title="Clients who chase themselves">
            A client sees exactly what&rsquo;s outstanding in their portal, uploads straight into it, and is reminded automatically until
            it&rsquo;s done. When you need to explain what a document is, the AI writes the note in plain English and you send it.
          </Card>
          <Card icon={<HardHat size={20} />} title="Inspections finished on site">
            Photos, issues, the signed report and the Portal notification, all from a phone before you leave. No evening of writing up.
          </Card>
          <Card icon={<Scale size={20} />} title="A defensible record">
            When the Building Commission asks, or a dispute arrives years later: every version of every certificate, every signed report,
            an audit log nobody can edit, and the emails that went out. The whole file is there.
          </Card>
          <Card icon={<Lock size={20} />} title="Your data stays yours">
            Each firm&rsquo;s projects are walled off from every other at the database level. Nightly backups can go to your own Dropbox or
            OneDrive. Deleted projects are recoverable for thirty days, then gone for good &mdash; documents included.
          </Card>
        </div>
      </Section>

      <Section title="What it deliberately does not do" lead="A tool for a regulated profession should be as clear about its limits as its features.">
        <ul className="max-w-2xl space-y-4 text-[15px] leading-relaxed text-slate-600">
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2fa6a0]" />
            <span>
              <span className="font-semibold text-slate-900">The AI never decides anything.</span> It writes up facts the app already holds and
              suggests details you confirm. What a project needs, whether a document is required, what a certificate says &mdash; those are
              the certifier&rsquo;s, and the app is built so they can&rsquo;t be otherwise.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2fa6a0]" />
            <span>
              <span className="font-semibold text-slate-900">Nothing is sent on its own.</span> Certificates, reports, notes to clients &mdash;
              every one goes out because someone pressed Send. The only automatic emails are the document and invoice reminders you switch
              on, and they stop the moment you&rsquo;ve been in touch.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2fa6a0]" />
            <span>
              <span className="font-semibold text-slate-900">A silence is never a clearance.</span> When a map service has nothing over a parcel,
              Certlyn says &ldquo;not identified&rdquo;, not &ldquo;no&rdquo;. A planning fact guessed wrong is worse than one not offered.
            </span>
          </li>
        </ul>
      </Section>

      <CallToAction title="See it running on your own projects." blurb="Book a demo and we'll walk you through Certlyn on your own screen, then set your firm up and bring your current jobs across from a spreadsheet." primary={{ href: "/join?intent=demo", label: "Book a Demo" }} secondary={{ href: "/join?intent=launch-offer", label: "Join the Certlyn launch program" }} />
    </MarketingShell>
  );
}
