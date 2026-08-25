import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FirmForm, CertifierList, ClientList } from "@/components/certifier/SettingsForms";
import { CloudBackupSection } from "@/components/certifier/CloudBackupSection";
import { getBackupStatus } from "@/lib/actions/backup";
import { DocumentLibrarySection } from "@/components/certifier/DocumentLibrarySection";
import { signedUrl } from "@/lib/storage";

export default async function SettingsPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const [{ data: firm }, { data: certifiers }, { data: clients }, { data: libraryItems }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
    supabase.from("certifiers").select("*").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("clients").select("*").eq("firm_id", profile.firm_id).order("name"),
    supabase.from("document_library_items").select("*").eq("firm_id", profile.firm_id).order("sort_order"),
  ]);

  const backup = await getBackupStatus(profile.firm_id);

  const signatureUrls: Record<string, string> = {};
  // A contract certifier's own company logo, for the letterhead their
  // inspection reports go out on.
  const practiceLogoUrls: Record<string, string> = {};
  await Promise.all(
    (certifiers || []).map(async (c) => {
      const [signature, logo] = await Promise.all([signedUrl(c.signature_url), signedUrl(c.practice_logo_url)]);
      if (signature) signatureUrls[c.id] = signature;
      if (logo) practiceLogoUrls[c.id] = logo;
    })
  );
  // The blank forms attached to library items, signed for download so the
  // certifier can check what the client is being handed.
  const templateUrls: Record<string, string> = {};
  await Promise.all(
    (libraryItems || []).map(async (item) => {
      if (item.template_file_path) {
        const url = await signedUrl(item.template_file_path);
        if (url) templateUrls[item.id] = url;
      }
    })
  );

  const logoUrl = firm?.logo_url ? (await signedUrl(firm.logo_url)) || undefined : undefined;
  const stampUrl = firm?.stamp_url ? (await signedUrl(firm.stamp_url)) || undefined : undefined;

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-xl font-bold text-primary">Settings</h1>

      <section className="bg-white rounded-lg border border-line">
        <div className="px-5 py-3 border-b border-line font-bold text-primary">Firm details</div>
        <div className="p-5">
          <FirmForm firm={firm} logoUrl={logoUrl} stampUrl={stampUrl} />
        </div>
      </section>

      <section className="bg-white rounded-lg border border-line">
        <div className="px-5 py-3 border-b border-line font-bold text-primary">Cloud backup</div>
        <div className="p-5">
          <CloudBackupSection configured={backup.configured} connections={backup.connections} />
        </div>
      </section>

      <section className="bg-white rounded-lg border border-line">
        <div className="px-5 py-3 border-b border-line font-bold text-primary">Certifiers</div>
        <div className="p-5">
          <CertifierList certifiers={certifiers || []} firmId={profile.firm_id} signatureUrls={signatureUrls} practiceLogoUrls={practiceLogoUrls} />
        </div>
      </section>

      <section className="bg-white rounded-lg border border-line">
        <div className="px-5 py-3 border-b border-line font-bold text-primary">Clients &amp; portal access</div>
        <div className="p-5">
          <ClientList clients={clients || []} />
        </div>
      </section>

      <section className="bg-white rounded-lg border border-line">
        <div className="px-5 py-3 border-b border-line font-bold text-primary">Document Library</div>
        <div className="p-5">
          <DocumentLibrarySection items={libraryItems || []} firmId={profile.firm_id} templateUrls={templateUrls} />
        </div>
      </section>
    </div>
  );
}
