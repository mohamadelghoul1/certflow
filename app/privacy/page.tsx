import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, Hero } from "@/components/marketing/MarketingShell";
import { OPERATOR_NAME, LEGAL_UPDATED, legalContact } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy — Certlyn",
  description: "What Certlyn collects, why, who it is shared with, and how it is kept.",
};

// Written to be true of the app as it is, in plain words, against the
// Australian Privacy Principles. Every processor named here is one the
// code actually sends data to; nothing is described that the app does
// not do.

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-[22px] font-bold">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-slate-300">{children}</p>;
}
function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-slate-300">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0b93a]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  const contact = legalContact();
  return (
    <MarketingShell current="">
      <Hero kicker="Privacy policy" title="How Certlyn handles personal information.">
        Last updated {LEGAL_UPDATED}. This policy explains what {OPERATOR_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects through the
        Certlyn service and website, why, who it is shared with, and the choices you have. We handle personal information in line with the
        Australian Privacy Principles in the Privacy Act 1988 (Cth).
      </Hero>

      <div className="max-w-3xl">
        <H>Who this covers</H>
        <P>
          Certlyn is used by building certification firms (&ldquo;firms&rdquo;) to run their projects, and by their clients &mdash;
          owners, applicants and builders &mdash; through a client portal. This policy covers everyone whose information passes through it:
          the people at a firm, their clients, and visitors to this website.
        </P>
        <P>
          A firm decides what it records about its own clients and projects. For that information the firm is the organisation responsible
          under privacy law, and we hold it on the firm&rsquo;s behalf and on its instructions. Questions about what a particular firm holds
          about you are best put to that firm first.
        </P>

        <H>What we collect</H>
        <UL
          items={[
            <>
              <span className="font-semibold text-white">From firms:</span> the firm&rsquo;s name, ABN, addresses, phone, email, logo and
              stamp; each certifier&rsquo;s name, registration number and expiry, insurance details, email, phone, Planning Portal login
              email and signature image; sending-address and payment settings, including bank details printed on invoices.
            </>,
            <>
              <span className="font-semibold text-white">About clients and projects, entered by a firm or by the client:</span> names,
              contact details and postal addresses of applicants, owners and builders; site addresses and land details; the documents
              uploaded for a project and their details; inspection dates, outcomes, notes and photographs; certificates, reports and letters
              the firm issues; quotes and invoices.
            </>,
            <>
              <span className="font-semibold text-white">From visitors to this website:</span> what you enter in the &ldquo;Register your
              interest&rdquo; form &mdash; name, firm, email, phone and message.
            </>,
            <>
              <span className="font-semibold text-white">Automatically:</span> a sign-in session cookie, and a record of actions taken in
              the service (who did what, when) kept as an audit log. We do not run advertising or analytics trackers.
            </>,
          ]}
        />

        <H>Why we collect it</H>
        <UL
          items={[
            "To provide the service: to record projects, produce certificates, reports and invoices, book and record inspections, and let clients see and contribute to their own project.",
            "To send the emails the service sends: portal invitations, notifications a firm chooses to send, reminders about outstanding documents or unpaid invoices where a firm has switched them on, password resets.",
            "To keep the service secure and to keep an accurate record of what was done, which certifiers are required to hold.",
            "To respond when you register your interest or contact us.",
          ]}
        />

        <H>Who we share it with</H>
        <P>We do not sell personal information. We share it only with the providers that run the service, and only as far as they need it:</P>
        <UL
          items={[
            <>
              <span className="font-semibold text-white">Hosting and database</span> (Vercel and Supabase) &mdash; where the service runs and
              its data and documents are stored.
            </>,
            <>
              <span className="font-semibold text-white">Email delivery</span> (Resend) &mdash; to send the emails described above.
            </>,
            <>
              <span className="font-semibold text-white">Card payments</span> (Stripe) &mdash; when a client pays an invoice by card. Card
              details are entered on Stripe&rsquo;s own pages and never reach Certlyn.
            </>,
            <>
              <span className="font-semibold text-white">AI assistance</span> (Anthropic) &mdash; where a firm has switched it on. Most uses
              send only project details and document titles. A document itself is sent only when a certifier presses &ldquo;Read the details
              with AI&rdquo; on that document, and only its first pages. Anthropic&rsquo;s API does not use this to train its models.
            </>,
            <>
              <span className="font-semibold text-white">Cloud backup</span> (Dropbox or Microsoft OneDrive) &mdash; only if a firm connects its
              own account, and only into that account.
            </>,
            <>
              <span className="font-semibold text-white">NSW Planning Portal</span> &mdash; when a firm reports an inspection or certificate, as
              it is required to by law.
            </>,
          ]}
        />
        <P>
          Some of these providers store or process data outside Australia. Where they do, we rely on their contractual commitments to protect
          it to a standard at least equivalent to Australian law.
        </P>

        <H>How it is kept</H>
        <UL
          items={[
            "Each firm's data is separated from every other firm's by rules enforced in the database itself, not only by the screens.",
            "Access is by password, with optional two-factor sign-in for certifiers. Connections are encrypted.",
            "Documents are stored privately and reached only through short-lived links issued to signed-in users.",
            "The audit log is append-only: entries cannot be edited or removed once written.",
          ]}
        />

        <H>How long it is kept</H>
        <P>
          Project records are kept for as long as the firm keeps them, because certifiers are required to retain their records for years. A
          project a firm deletes is recoverable for thirty days, after which it and every document in it are permanently removed. A firm that
          leaves Certlyn can export its records and have its data removed. Messages sent through the &ldquo;Register your interest&rdquo;
          form are emailed to us and not stored in the service.
        </P>

        <H>Your rights</H>
        <P>
          You can ask to see the personal information we hold about you, and to have it corrected. Where it was entered by a firm about its
          client, we will usually refer the request to that firm, which holds the relationship with you. If you believe we have mishandled
          your information, tell us and we will look into it; if you are not satisfied with our response you can complain to the Office of
          the Australian Information Commissioner.
        </P>

        <H>Cookies</H>
        <P>
          Certlyn uses only the cookies needed to keep you signed in. There are no advertising or tracking cookies.
        </P>

        <H>Changes</H>
        <P>
          We will update this policy when the service changes in a way that affects it, and show the date at the top. Material changes will be
          notified to firms by email.
        </P>

        <H>Contact</H>
        <P>
          {contact.email ? (
            <>
              Privacy questions and requests: <a href={`mailto:${contact.email}`} className="text-[#f0b93a] hover:underline">{contact.email}</a>.
            </>
          ) : (
            <>
              Privacy questions and requests can be sent through the form on the{" "}
              <Link href={contact.formPath} className="text-[#f0b93a] hover:underline">
                For certifiers
              </Link>{" "}
              page.
            </>
          )}
        </P>
      </div>
    </MarketingShell>
  );
}
