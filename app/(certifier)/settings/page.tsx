import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FirmForm, CertifierList, ClientList, ReminderSettingsForm, PaymentSettingsForm, StripeConnectionForm } from "@/components/certifier/SettingsForms";
import { firmStripeStatus, deploymentStripeConfigured } from "@/lib/payments/stripe";
import { siteUrl } from "@/lib/siteUrl";
import { CloudBackupSection } from "@/components/certifier/CloudBackupSection";
import { CertificateLayoutEditor } from "@/components/certifier/CertificateLayoutEditor";
import { certificateTemplatesForFirm } from "@/lib/actions/certificateTemplates";
import { getBackupStatus } from "@/lib/actions/backup";
import { DocumentLibrarySection } from "@/components/certifier/DocumentLibrarySection";
import { signedUrl } from "@/lib/storage";
import { runSystemChecks, runEnvChecks, runNotificationChecks } from "@/lib/systemCheck";
import { getStorageUsage } from "@/lib/storageUsage";
import { StorageSection } from "@/components/certifier/StorageSection";
import { SystemCheckSection } from "@/components/certifier/SystemCheckSection";
import Link from "next/link";
import { Building2, Landmark, BellRing, Users, KeyRound, Library, CloudUpload, Activity, FileText, type LucideIcon, HardDrive } from "lucide-react";

// Settings, one section at a time. Everything used to sit on one long
// page; finding the certifier list meant scrolling past the firm form
// every visit. Now each section is its own screen behind a menu, and —
// as usefully — only the section being looked at is fetched, so opening
// Settings no longer runs every query the page knows.

const SECTIONS: { key: string; label: string; icon: LucideIcon; blurb: string }[] = [
  { key: "firm", label: "Firm details", icon: Building2, blurb: "Name, addresses, logo, stamp and Portal account" },
  { key: "payments", label: "Payment details", icon: Landmark, blurb: "Bank details on invoices, card surcharge, your Stripe account" },
  { key: "reminders", label: "Client reminders", icon: BellRing, blurb: "Automatic chasing of outstanding documents" },
  { key: "certifiers", label: "Certifiers", icon: Users, blurb: "The team, signatures and registrations" },
  { key: "clients", label: "Clients & portal access", icon: KeyRound, blurb: "Contacts and their portal logins" },
  { key: "library", label: "Document library", icon: Library, blurb: "What each checklist asks for" },
  { key: "certificates", label: "Certificate layout", icon: FileText, blurb: "What prints on your CDC, CC and OC" },
  { key: "backup", label: "Cloud backup", icon: CloudUpload, blurb: "Copies in your own Dropbox or OneDrive" },
  { key: "storage", label: "Storage", icon: HardDrive, blurb: "What each project is holding" },
  { key: "system", label: "System check", icon: Activity, blurb: "Database updates and connected services" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section = "firm" } = await searchParams;
  const active = SECTIONS.find((s) => s.key === section) || SECTIONS[0];
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  let content: React.ReactNode = null;

  if (active.key === "firm" || active.key === "payments" || active.key === "reminders") {
    const { data: firm } = await supabase.from("firms").select("*").eq("id", profile.firm_id).single();
    if (active.key === "firm") {
      const logoUrl = firm?.logo_url ? (await signedUrl(firm.logo_url)) || undefined : undefined;
      const stampUrl = firm?.stamp_url ? (await signedUrl(firm.stamp_url)) || undefined : undefined;
      content = <FirmForm firm={firm} logoUrl={logoUrl} stampUrl={stampUrl} />;
    } else if (active.key === "payments") {
      const [stripeStatus, base] = await Promise.all([firmStripeStatus(supabase), siteUrl()]);
      content = (
        <>
          <PaymentSettingsForm firm={firm} />
          <StripeConnectionForm status={stripeStatus} webhookUrl={`${base}/api/stripe/webhook`} deploymentConfigured={deploymentStripeConfigured()} />
        </>
      );
    } else {
      content = <ReminderSettingsForm firm={firm} />;
    }
  } else if (active.key === "certifiers") {
    const { data: certifiers } = await supabase.from("certifiers").select("*").eq("firm_id", profile.firm_id).order("name");
    const signatureUrls: Record<string, string> = {};
    const practiceLogoUrls: Record<string, string> = {};
    await Promise.all(
      (certifiers || []).map(async (c) => {
        const [signature, logo] = await Promise.all([signedUrl(c.signature_url), signedUrl(c.practice_logo_url)]);
        if (signature) signatureUrls[c.id] = signature;
        if (logo) practiceLogoUrls[c.id] = logo;
      })
    );
    content = <CertifierList certifiers={certifiers || []} firmId={profile.firm_id} signatureUrls={signatureUrls} practiceLogoUrls={practiceLogoUrls} />;
  } else if (active.key === "clients") {
    const { data: clients } = await supabase.from("clients").select("*").eq("firm_id", profile.firm_id).order("name");
    content = <ClientList clients={clients || []} />;
  } else if (active.key === "library") {
    const { data: libraryItems } = await supabase.from("document_library_items").select("*").eq("firm_id", profile.firm_id).order("sort_order");
    const templateUrls: Record<string, string> = {};
    await Promise.all(
      (libraryItems || []).map(async (item) => {
        if (item.template_file_path) {
          const url = await signedUrl(item.template_file_path);
          if (url) templateUrls[item.id] = url;
        }
      })
    );
    content = <DocumentLibrarySection items={libraryItems || []} firmId={profile.firm_id} templateUrls={templateUrls} />;
  } else if (active.key === "storage") {
    content = <StorageSection usage={await getStorageUsage(supabase, profile.firm_id)} />;
  } else if (active.key === "certificates") {
    const templates = await certificateTemplatesForFirm(profile.firm_id);
    content = (
      <div className="space-y-3">
        <p className="text-xs text-muted">
          Every certificate uses CertFlow&rsquo;s standard layout unless you change it here. What you set applies to certificates generated from now
          on; anything already issued keeps the layout it was issued under.
        </p>
        {templates.map((t) => (
          <CertificateLayoutEditor key={t.pathway} pathway={t.pathway} custom={t.custom} template={t.template} />
        ))}
      </div>
    );
  } else if (active.key === "backup") {
    const backup = await getBackupStatus(profile.firm_id);
    content = <CloudBackupSection configured={backup.configured} connections={backup.connections} />;
  } else {
    content = (
      <SystemCheckSection
        checks={await runSystemChecks(supabase)}
        env={runEnvChecks()}
        notifications={await runNotificationChecks(supabase, profile.firm_id)}
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-primary mb-6">Settings</h1>
      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-6 lg:items-start">
        {/* The menu: a column beside the content on a desktop, a
            scrollable strip above it on a phone. */}
        <nav className="mb-5 lg:mb-0 flex gap-1 overflow-x-auto pb-1 lg:pb-0 lg:flex-col lg:overflow-visible" style={{ scrollbarWidth: "none" }}>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const current = s.key === active.key;
            return (
              <Link
                key={s.key}
                href={`/settings?section=${s.key}`}
                className={`flex items-center gap-2.5 shrink-0 rounded-md px-3 py-2 text-sm whitespace-nowrap ${
                  current ? "bg-primary text-white font-semibold" : "text-muted hover:bg-hover hover:text-primary"
                }`}
              >
                <Icon size={15} className={current ? "" : "text-icon"} />
                {s.label}
              </Link>
            );
          })}
        </nav>

        <section className="bg-white rounded-lg border border-line max-w-3xl min-w-0">
          <div className="px-5 py-3 border-b border-line">
            <div className="font-bold text-primary">{active.label}</div>
            <div className="text-[11px] text-placeholder">{active.blurb}</div>
          </div>
          <div className="p-5">{content}</div>
        </section>
      </div>
    </div>
  );
}
