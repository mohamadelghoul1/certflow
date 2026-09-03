import type { Metadata } from "next";
import { Upload, Building2, PenLine, Mail, HelpCircle } from "lucide-react";
import { MarketingShell, Hero, Section, Card } from "@/components/marketing/MarketingShell";
import { RegisterInterestForm } from "@/components/marketing/RegisterInterestForm";

export const metadata: Metadata = {
  title: "Join Certlyn",
  description: "For NSW building certifiers: what joining Certlyn involves, and how to register your interest.",
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
    a: "We'll talk it through when you register — it depends on how many certifiers you have. There is no setup fee for bringing your projects across.",
  },
];

export default function JoinPage() {
  return (
    <MarketingShell current="/join">
      <Hero kicker="For certifiers" title={<>Run your practice on Certlyn. <span className="text-[#f0b93a]">We&rsquo;ll set it up with you.</span></>}>
        Certlyn is used every day by a working NSW certification practice, and it&rsquo;s ready for yours. Joining is a conversation, not a
        sign-up page: we set up your firm, bring your projects across, and stay on hand while you get going.
      </Hero>

      <Section title="What joining looks like">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card icon={<Building2 size={20} />} title="Your firm, set up for you">
            Your logo, your ABN, your certifiers with their registrations and signatures, your sending address. Done with you on a call,
            not from a form.
          </Card>
          <Card icon={<Upload size={20} />} title="Your projects, brought across">
            One spreadsheet, dropped on the Import page. Every job under construction lands with its approval recorded and its
            inspections ready.
          </Card>
          <Card icon={<PenLine size={20} />} title="Your wording and layout">
            Start from the standard certificate, letter and report layouts and change any wording you like. Or keep them as they are.
          </Card>
          <Card icon={<Mail size={20} />} title="Your clients, invited">
            Each client gets a portal login by email. From then on they upload into it, book inspections from it, and pay invoices through
            it.
          </Card>
        </div>
      </Section>

      <Section title="Register your interest" lead="Tell us a little about your practice and we'll be in touch to arrange a walk-through.">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <RegisterInterestForm />
          </div>
          <div className="lg:col-span-2 space-y-4 text-[15px] leading-relaxed text-slate-300">
            <p>
              <span className="font-semibold text-white">Who you&rsquo;ll hear from.</span> A certifier, not a sales team. The people
              behind Certlyn issue certificates and carry out inspections with it every week.
            </p>
            <p>
              <span className="font-semibold text-white">What a walk-through covers.</span> Your own project, start to finish, on your
              own screen &mdash; and the questions you have about how you work now.
            </p>
            <p>
              <span className="font-semibold text-white">No obligation.</span> If it isn&rsquo;t for you, nothing has been set up and
              nothing needs undoing.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Questions certifiers ask">
        <dl className="grid gap-6 sm:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-2xl border border-slate-800 p-5">
              <dt className="flex items-start gap-2 text-[16px] font-bold">
                <HelpCircle size={18} className="mt-0.5 shrink-0 text-[#f0b93a]" /> {item.q}
              </dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-slate-300">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </MarketingShell>
  );
}
