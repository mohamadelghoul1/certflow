import type { Metadata } from "next";
import { Upload, Building2, PenLine, Mail, HelpCircle } from "lucide-react";
import { MarketingShell, Hero, Section, Card } from "@/components/marketing/MarketingShell";
import { RegisterInterestForm } from "@/components/marketing/RegisterInterestForm";
import { isIntent, type Intent } from "@/lib/interest";
import { PRICE_LABEL, OFFER_JOIN_BY, OFFER_FREE_UNTIL, JOBS_PER_MONTH } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Book a demo — Certlyn",
  description: "Book a demo of Certlyn, join the launch program, or ask a question.",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is my data mixed with other firms'?",
    a: "No. Every firm's projects, clients, documents and settings are walled off from every other firm's at the database level, not just hidden by the screens. Nightly backups can go to your own Dropbox or OneDrive as well.",
  },
  {
    q: "What happens to the projects I already have?",
    a: "You fill in one spreadsheet — or drop in an export from whatever you use now — and every job under construction comes across with its approval recorded, ready for inspections and the Occupation Certificate. You see exactly what was read before anything is imported.",
  },
  {
    q: "Do emails come from Certlyn or from us?",
    a: "From you. Clients see your firm's name, and replies land in your inbox. If you have your own domain we can send from it.",
  },
  {
    q: "Does it report to the NSW Planning Portal?",
    a: "Certlyn tracks every inspection and certificate against its Portal case, counts the two-business-day window, and has direct API reporting built and waiting on the department's onboarding. Until then, reporting is one click in Certlyn and the same details in the Portal.",
  },
  {
    q: "What does the AI see?",
    a: "As little as it needs. The morning note is written from facts the app has already worked out. The plain-English note to a client is written from document titles. Only when you press 'Read the details with AI' on a document does that document itself go, and only its first pages. It is never used to train anything.",
  },
  {
    q: "What does it cost?",
    a: `${PRICE_LABEL} per month for your firm — unlimited certifiers, up to ${JOBS_PER_MONTH} new projects a month — after the launch program. Join before ${OFFER_JOIN_BY} and there is no subscription cost until ${OFFER_FREE_UNTIL}. No setup fee.`,
  },
];

const HEADINGS: Record<Intent, { title: React.ReactNode; lead: string }> = {
  demo: { title: <>Book a demo. <span className="text-[#d99a12]">Your own project, start to finish.</span></>, lead: "Tell us a little about your practice and we'll arrange a walk-through on your own screen." },
  "launch-offer": {
    title: <>Join the Certlyn launch program. <span className="text-[#d99a12]">Free until {OFFER_FREE_UNTIL}.</span></>,
    lead: `Firms that join before ${OFFER_JOIN_BY} use Certlyn at no subscription cost until ${OFFER_FREE_UNTIL}. Leave your details and we'll set your firm up.`,
  },
  question: { title: <>Ask us anything.</>, lead: "A question about the product, pricing, security or bringing your projects across — we'll answer it." },
};

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const { intent: raw } = await searchParams;
  const intent: Intent = isIntent(raw) ? raw : "demo";
  const heading = HEADINGS[intent];

  return (
    <MarketingShell current="/join">
      <Hero kicker="Contact" title={heading.title}>
        {heading.lead}
      </Hero>

      <Section title="Get in touch">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <RegisterInterestForm defaultIntent={intent} />
          </div>
          <div className="lg:col-span-2 space-y-4 text-[15px] leading-relaxed text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Who you&rsquo;ll hear from.</span> The Certlyn team &mdash; people who know NSW
              certification and have spent a long time listening to certifiers about what they need from their software.
            </p>
            <p>
              <span className="font-semibold text-slate-900">What a demo covers.</span> Your own project, start to finish, on your own screen
              &mdash; and the questions you have about how you work now. About forty minutes.
            </p>
            <p>
              <span className="font-semibold text-slate-900">No obligation.</span> If it isn&rsquo;t for you, nothing has been set up and nothing
              needs undoing.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="tint" title="What joining looks like">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card icon={<Building2 size={20} />} title="Your firm, set up for you">
            Your logo, your ABN, your certifiers with their registrations and signatures, your sending address. Done with you on a call, not
            from a form.
          </Card>
          <Card icon={<Upload size={20} />} title="Your projects, brought across">
            One spreadsheet, dropped on the Import page. Every job under construction lands with its approval recorded and its inspections
            ready.
          </Card>
          <Card icon={<PenLine size={20} />} title="Your wording and layout">
            Start from the standard certificate, letter and report layouts and change any wording you like. Or keep them as they are.
          </Card>
          <Card icon={<Mail size={20} />} title="Your clients, invited">
            Each client gets a portal login by email. From then on they upload into it, book inspections from it, and pay invoices through it.
          </Card>
        </div>
      </Section>

      <Section title="Questions certifiers ask">
        <dl className="grid gap-5 sm:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <dt className="flex items-start gap-2 text-[16px] font-bold text-slate-900">
                <HelpCircle size={18} className="mt-0.5 shrink-0 text-[#1f7f7a]" /> {item.q}
              </dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-slate-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </MarketingShell>
  );
}
