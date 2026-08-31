import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, Phone, Navigation } from "lucide-react";
import { formatISODate } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { directionsUrl } from "@/lib/site/visitList";
import { quickItemsFor, isQuickItem } from "@/lib/inspectionQuickItems";
import { OutcomeChoice } from "@/components/site/OutcomeChoice";
import { SiteOutcomeState } from "@/components/site/SiteOutcome";
import { SiteSteps } from "@/components/site/SiteSteps";
import { SiteIssues } from "@/components/site/SiteIssues";
import { SitePhotos } from "@/components/site/SitePhotos";
import { SiteNotes } from "@/components/site/SiteNotes";
import { FinishOnSite } from "@/components/site/FinishOnSite";
import type { Defect, InspectionPhoto, JobDetails } from "@/types/db";

// One inspection, one screen, in the order the work happens: where am I,
// what did I find, what is wrong, photographs, anything else, sign, send.
//
// Nothing here needs a second hand or a steady desk.
export default async function SiteInspectionPage({ params }: { params: Promise<{ inspectionId: string }> }) {
  const { inspectionId } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data } = await supabase
    .from("inspections")
    .select("*, defects(*), inspection_photos(*), jobs!inner(id, address, details, deleted_at)")
    .eq("id", inspectionId)
    .single();
  if (!data) notFound();

  const inspection = data as unknown as {
    id: string;
    title: string;
    description: string | null;
    date: string | null;
    outcome: string;
    report_signed_at: string | null;
    report_sent: boolean;
    report_sent_date: string | null;
    report_notes: string | null;
    defects: Defect[];
    inspection_photos: InspectionPhoto[];
    jobs: { id: string; address: string; details: JobDetails | null; deleted_at: string | null };
  };
  if (inspection.jobs.deleted_at) notFound();

  const jobId = inspection.jobs.id;
  const address = inspection.jobs.address || "";
  const contact = inspection.jobs.details?.contact;
  const photoUrls = await Promise.all(inspection.inspection_photos.map((p) => signedUrl(p.file_path)));

  return (
    <div className="space-y-4">
      <Link href="/site" className="inline-flex items-center gap-1 text-sm font-medium text-secondary -ml-1">
        <ChevronLeft size={17} /> Today&rsquo;s inspections
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-heading tracking-tight leading-tight">{inspection.title}</h1>
        <div className="text-sm text-muted mt-1 flex items-start gap-1.5">
          <MapPin size={15} className="shrink-0 mt-0.5 text-placeholder" />
          {address}
        </div>
        <div className="text-xs text-placeholder mt-1">{formatISODate(inspection.date)}</div>
      </header>

      {/* Getting there and getting hold of someone: the two things needed
          before the inspection can even start. */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={directionsUrl(address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white py-3 text-sm font-semibold text-primary"
        >
          <Navigation size={16} /> Directions
        </a>
        {contact?.phone ? (
          <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white py-3 text-sm font-semibold text-primary">
            <Phone size={16} /> Call site
          </a>
        ) : (
          <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white py-3 text-sm text-placeholder">
            <Phone size={16} /> No number
          </span>
        )}
      </div>

      {/* The outcome is held above the steps because it decides whether
          there is an issues step at all, and what it is called. */}
      <SiteOutcomeState inspectionId={inspection.id} jobId={jobId} outcome={inspection.outcome}>
        <SiteSteps
          hasIssues={inspection.defects.length > 0}
          hasQuickItems={quickItemsFor(inspection.title).length > 0}
          allIssuesStandard={inspection.defects.every((d) => isQuickItem(d.text, quickItemsFor(inspection.title)))}
          issues={<SiteIssues inspectionId={inspection.id} jobId={jobId} title={inspection.title} issues={inspection.defects.map((d) => ({ id: d.id, text: d.text }))} />}
          steps={[
            { key: "outcome", title: "What did you find?", node: <OutcomeChoice /> },
            {
              key: "photos",
              title: "Photos",
              node: (
                <SitePhotos
                  inspectionId={inspection.id}
                  jobId={jobId}
                  pathPrefix={`${profile.firm_id}/${jobId}/inspections/${inspection.id}`}
                  photos={inspection.inspection_photos.map((p, i) => ({ id: p.id, url: photoUrls[i] }))}
                />
              ),
            },
            { key: "notes", title: "Notes", node: <SiteNotes inspectionId={inspection.id} jobId={jobId} notes={inspection.report_notes || ""} /> },
            {
              key: "finish",
              title: "Sign and send",
              node: (
                <FinishOnSite
                  inspectionId={inspection.id}
                  jobId={jobId}
                  outcome={inspection.outcome}
                  signedAt={inspection.report_signed_at}
                  sentAt={inspection.report_sent ? inspection.report_sent_date || "sent" : null}
                  reportHref={`/jobs/${jobId}/inspections/${inspection.id}/report`}
                />
              ),
            },
          ]}
        />
      </SiteOutcomeState>

      <Link href={`/jobs/${jobId}`} className="block text-center text-sm text-placeholder py-2">
        Open the full project
      </Link>
    </div>
  );
}
