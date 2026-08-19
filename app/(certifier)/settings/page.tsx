import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FirmForm, CertifierList, ClientList } from "@/components/certifier/SettingsForms";
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

  const signatureUrls: Record<string, string> = {};
  await Promise.all(
    (certifiers || []).map(async (c) => {
      if (c.signature_url) {
        const url = await signedUrl(c.signature_url);
        if (url) signatureUrls[c.id] = url;
      }
    })
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-xl font-bold text-teal-900">Settings</h1>

      <section className="bg-white rounded-lg border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">Firm details</div>
        <div className="p-5">
          <FirmForm firm={firm} />
        </div>
      </section>

      <section className="bg-white rounded-lg border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">Certifiers</div>
        <div className="p-5">
          <CertifierList certifiers={certifiers || []} firmId={profile.firm_id} signatureUrls={signatureUrls} />
        </div>
      </section>

      <section className="bg-white rounded-lg border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">Clients &amp; portal access</div>
        <div className="p-5">
          <ClientList clients={clients || []} />
        </div>
      </section>

      <section className="bg-white rounded-lg border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-teal-900">Document Library</div>
        <div className="p-5">
          <DocumentLibrarySection items={libraryItems || []} />
        </div>
      </section>
    </div>
  );
}
