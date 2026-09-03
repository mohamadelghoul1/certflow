import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, Hero } from "@/components/marketing/MarketingShell";
import { OPERATOR_NAME, LEGAL_UPDATED, GOVERNING_LAW, legalContact } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of use — Certlyn",
  description: "The terms on which Certlyn is provided to certification firms and their clients.",
};

// The terms, in the same plain words as the rest of the site. The one
// clause that matters more than the others — that the certifier, not
// the software, makes every statutory decision — is stated first and
// plainly, because it is both true and the thing a regulator will ask.

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

export default function TermsPage() {
  const contact = legalContact();
  return (
    <MarketingShell current="">
      <Hero kicker="Terms of use" title="The terms Certlyn is provided on.">
        Last updated {LEGAL_UPDATED}. These terms apply to every firm that uses Certlyn and to every person who signs in, including a
        firm&rsquo;s clients using the portal. By using the service you agree to them. Fees and the length of a firm&rsquo;s subscription are
        set out in the written agreement between {OPERATOR_NAME} and the firm, which sits alongside these terms.
      </Hero>

      <div className="max-w-3xl">
        <H>1. What Certlyn is, and what it is not</H>
        <P>
          Certlyn is software for recording and managing building certification work. It is not a certifier and does not provide
          certification, building, planning or legal advice.
        </P>
        <P>
          Every statutory decision &mdash; what a project requires, whether a document is acceptable, whether a certificate should be
          issued, what an inspection found, what is reported to the NSW Planning Portal &mdash; is made by the registered certifier using the
          service, who remains responsible for it under the Environmental Planning and Assessment Act 1979 and the Building and Development
          Certifiers Act 2018. Certlyn assists with the recording and paperwork; it does not and cannot take over that responsibility.
        </P>

        <H>2. Accounts</H>
        <UL
          items={[
            "A firm is responsible for the people it gives access to, for keeping passwords private, and for telling us promptly if an account may have been compromised.",
            "Each login is for one person. Certifiers must not share a login; a certifier's signature is applied only by that certifier.",
            "A firm's clients are given portal access by the firm, and see only the projects that firm has shared with them.",
          ]}
        />

        <H>3. Your data</H>
        <UL
          items={[
            "Everything a firm records in Certlyn — projects, documents, certificates, reports, client details — belongs to the firm. We claim no rights over it.",
            "We hold it on the firm's behalf and use it only to provide the service, as described in our privacy policy.",
            "A firm may export its records at any time, and on leaving Certlyn may ask for its data to be removed. Records a certifier is legally required to keep remain the firm's responsibility to retain.",
          ]}
        />

        <H>4. Acceptable use</H>
        <P>You must not use Certlyn to:</P>
        <UL
          items={[
            "record anything you know to be false, or issue any document you are not entitled to issue;",
            "access, or attempt to access, another firm's data;",
            "upload material that infringes someone else's rights or is unlawful;",
            "interfere with the service, probe its security, or place unreasonable load on it.",
          ]}
        />

        <H>5. AI features</H>
        <P>
          Where a firm switches them on, some features use an AI model to write notes and read documents. Its output is a suggestion: it
          is shown for a person to check, and nothing it produces is issued, sent or saved without that person acting. The firm is responsible
          for reviewing anything it accepts. AI features may be unavailable from time to time and may be changed or withdrawn.
        </P>

        <H>6. Third-party services</H>
        <P>
          Certlyn relies on providers for hosting, email, card payments, AI and cloud backup, and on the NSW Planning Portal. We choose them
          with care, but we do not control them and cannot guarantee their availability or conduct. Card payments are subject to Stripe&rsquo;s
          terms; cloud backups go to accounts the firm controls under those providers&rsquo; terms.
        </P>

        <H>7. Availability and support</H>
        <P>
          We aim to keep Certlyn available at all times but do not guarantee uninterrupted service. We may take it offline for maintenance,
          with notice where practicable. Support is provided to firms by email during business hours in New South Wales.
        </P>

        <H>8. Fees</H>
        <P>
          Fees, billing periods and any trial are as agreed in writing with the firm. Fees are payable in advance. We may change fees on at
          least thirty days&rsquo; written notice, taking effect from the next billing period.
        </P>

        <H>9. Ending the agreement</H>
        <UL
          items={[
            "A firm may end its subscription at any time by written notice, effective at the end of the current billing period.",
            "We may suspend or end access if these terms are breached and the breach is not remedied within fourteen days of notice, or immediately where the breach is serious or unlawful.",
            "On ending, a firm has thirty days to export its records. After that we may delete them, except where we are required by law to retain anything.",
          ]}
        />

        <H>10. Liability</H>
        <P>
          Nothing in these terms excludes rights you have under the Australian Consumer Law that cannot be excluded. To the extent the law
          allows, our liability for any claim arising from the service is limited to the fees the firm paid in the twelve months before the
          claim, and we are not liable for indirect or consequential loss, including loss of profit or business.
        </P>
        <P>
          In particular, because every certification decision is the certifier&rsquo;s, we are not liable for the consequences of a
          certificate, report or notice a certifier issues, or fails to issue, using the service.
        </P>

        <H>11. Changes to these terms</H>
        <P>
          We may update these terms. We will show the date at the top, and give firms at least thirty days&rsquo; notice by email of any
          change that reduces their rights. Continued use after that date is acceptance of the updated terms.
        </P>

        <H>12. Governing law</H>
        <P>These terms are governed by the law of {GOVERNING_LAW}, and its courts have jurisdiction over any dispute.</P>

        <H>Contact</H>
        <P>
          {contact.email ? (
            <>
              Questions about these terms: <a href={`mailto:${contact.email}`} className="text-[#f0b93a] hover:underline">{contact.email}</a>.
            </>
          ) : (
            <>
              Questions about these terms can be sent through the form on the{" "}
              <Link href={contact.formPath} className="text-[#f0b93a] hover:underline">
                For certifiers
              </Link>{" "}
              page.
            </>
          )}{" "}
          Our{" "}
          <Link href="/privacy" className="text-[#f0b93a] hover:underline">
            privacy policy
          </Link>{" "}
          explains how personal information is handled.
        </P>
      </div>
    </MarketingShell>
  );
}
