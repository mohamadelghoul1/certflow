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
import { SitePortalReport } from "@/components/site/SitePortalReport";
import { portalConfigured } from "@/lib/portal/config";
import { SignOnSite, EmailReportOnSite } from "@/components/site/FinishOnSite";
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
    portal_reported: boolean;
    portal_reported_date: string | null;
    inspector_certifier_id: string | null;
    defects: Defect[];
    inspection_photos: InspectionPhoto[];
    jobs: { id: string; address: string; details: JobDetails | null; deleted_at: string | null };
  };
  if (inspection.jobs.deleted_at) notFound();

  const jobId = inspection.jobs.id;
  const address = inspection.jobs.address || "";
  const contact = inspection.jobs.details?.contact;
  const photoUrls = await Promise.all(inspection.inspection_photos.map((p) => signedUrl(p.file_path)));

  // What the NSW Planning Portal step needs: the case the job is filed
  // under, and the Portal login the submission is recorded against —
  // the inspector's own where they have one, the signed-in certifier's
  // otherwise. Same rule the desktop panel uses.
  const portalCaseRef = inspection.jobs.details?.inspectionPortalCase || inspection.jobs.details?.certificateDetails?.planningPortalRef || "";
  const { data: inspector } = inspection.inspector_certifier_id
    ? await supabase.from("certifiers").select("*").eq("id", inspection.inspector_certifier_id).maybeSingle()
    : { data: null };
  const { data: me } = profile.certifier_id ? await supabase.from("certifiers").select("*").eq("id", profile.certifier_id).maybeSingle() : { data: null };
  const submitterEmail =
    (inspector as { portal_email?: string | null } | null)?.portal_email || (me as { portal_email?: string | null } | null)?.portal_email || profile.email || "";

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
            // Read it, sign it, tell the regulator, then — only if it is
            // wanted — tell the client. The order the work actually
            // happens in, and the Portal's two-day clock ahead of the
            // courtesy rather than behind it.
            {
              key: "finish",
              title: "Review and sign",
              node: (
                <SignOnSite
                  inspectionId={inspection.id}
                  jobId={jobId}
                  outcome={inspection.outcome}
                  signedAt={inspection.report_signed_at}
                  reportHref={`/jobs/${jobId}/inspections/${inspection.id}/report`}
                />
              ),
            },
            {
              key: "portal",
              title: "Report to the NSW Planning Portal",
              node: (
                <SitePortalReport
                  inspectionId={inspection.id}
                  jobId={jobId}
                  live={portalConfigured()}
                  defaultCaseId={portalCaseRef}
                  reported={!!inspection.portal_reported}
                  reportedDate={inspection.portal_reported_date}
                  signed={!!inspection.report_signed_at}
                  submittedBy={submitterEmail}
                />
              ),
            },
            {
              key: "email",
              title: "Email the client (optional)",
              node: (
                <EmailReportOnSite
                  inspectionId={inspection.id}
                  jobId={jobId}
                  signedAt={inspection.report_signed_at}
                  sentAt={inspection.report_sent ? inspection.report_sent_date || "sent" : null}
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
