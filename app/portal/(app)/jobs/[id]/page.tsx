import { pathwayLabel } from "@/lib/business";
import { INSPECTION_OUTCOME_BADGE } from "@/lib/constants";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, AlertTriangle, FileDown } from "lucide-react";
import { StageTabs } from "@/components/portal/StageTabs";
import { displayStatus, unresolvedCount, checklistProgress, formatISODate, todayISO, BOOKING_RULE_NOTE, bookingStage, BOOKING_STAGE_LABEL } from "@/lib/business";
import { currentDocuments } from "@/lib/checklistDocuments";
import { ItemDropCard } from "@/components/portal/ItemDropCard";
import { certificatesDownloadable, accessClosedNotice, inspectionBookingOpen } from "@/lib/portalAccess";
import { clientPortalInvoices } from "@/lib/invoices/portalInvoices";
import { PortalInvoices } from "@/components/portal/PortalInvoices";
import { signedUrl } from "@/lib/storage";
import { ClientItemDocuments } from "@/components/portal/ClientItemDocuments";
import { BookInspectionForm } from "@/components/portal/BookInspectionForm";
import type { ChecklistItem, Amendment, ChecklistItemFile, Certifier, Inspection, Defect, OcRecord } from "@/types/db";

type ItemWithAmendments = ChecklistItem & { amendments: Amendment[]; checklist_item_files?: ChecklistItemFile[] | null };

// Short enough to sit beside the inspection's name on a phone. The full
// wording is what prints on the report.
const OUTCOME_META: Record<string, { label: string; style: string }> = {
  pending: { label: INSPECTION_OUTCOME_BADGE.pending, style: "bg-surface text-muted" },
  passed: { label: INSPECTION_OUTCOME_BADGE.passed, style: "bg-success-bg text-success" },
  failed: { label: INSPECTION_OUTCOME_BADGE.failed, style: "bg-error-bg text-error" },
  passed_subject_to: { label: INSPECTION_OUTCOME_BADGE.passed_subject_to, style: "bg-warning-bg text-warning-text" },
};

export default async function PortalJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { id } = await params;
  const { stage: stageParam } = await searchParams;
  const { profile } = await requireProfile("client");
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  // A deleted project is gone as far as the client is concerned, even
  // though the certifier can still bring it back.
  if (!job || job.deleted_at) notFound();

  const [{ data: checklists }, { data: modifications }, { data: ocRecords }, { data: inspections }, { data: certifiers }] = await Promise.all([
    supabase
      .from("checklists")
      .select("id, kind, modification_id, checklist_items(*, amendments(*), checklist_item_files(*))")
      .eq("job_id", id)
      .order("sort_order", { referencedTable: "checklist_items" })
      .order("created_at", { referencedTable: "checklist_items" }),
    supabase.from("modifications").select("*").eq("job_id", id).order("created_at"),
    supabase.from("oc_records").select("*").eq("job_id", id).order("created_at"),
    supabase.from("inspections").select("*, defects(*)").eq("job_id", id),
    supabase.from("certifiers").select("*").eq("firm_id", job.firm_id),
  ]);

  const pathwayChecklist = (checklists || []).find((c) => c.kind === "pathway");
  const nocChecklist = (checklists || []).find((c) => c.kind === "noc");
  const ocChecklist = (checklists || []).find((c) => c.kind === "oc");
  const modChecklists = new Map((checklists || []).filter((c) => c.kind === "modification").map((c) => [c.modification_id, c]));

  const pathwayApprovalUrl = await signedUrl(job.pathway_approval_file_path);

  // This project's invoices, for the client actually billed. Read with
  // the admin client because invoices are the firm's records and client
  // RLS grants nothing on them — see lib/invoices/portalInvoices.
  const invoices = profile.client_id ? await clientPortalInvoices(createAdminClient(), profile.client_id, todayISO(), id) : [];

  // How to reach the firm, for a client who needs to move a booking they
  // have already agreed. Read with the admin client for the same reason
  // invoices are: a client has no read on firms at all. These are the
  // firm's own published contact details, shown to that firm's own
  // client — telling someone to ring without giving them the number is
  // how a change of date becomes a missed inspection.
  const { data: firmRow } = await createAdminClient().from("firms").select("phone, email").eq("id", job.firm_id).maybeSingle();
  // The office line is the fallback. The inspector's own mobile is
  // preferred where migration 0054 has been run and one is on file.
  const firmContact = (firmRow as { phone?: string | null; email?: string | null } | null) || null;

  // Which of this project's documents the firm has a blank form for.
  // Checklist items link to a library item whether or not a form has been
  // attached to it, and the document library isn't readable by a client at
  // all, so the check is made here with the admin client rather than by
  // offering a link that turns out to lead nowhere.
  const linkedLibraryIds = [
    ...new Set(
      (checklists || [])
        .flatMap((c) => (c.checklist_items as ItemWithAmendments[]) || [])
        .map((i) => i.template_library_item_id)
        .filter((id): id is string => !!id)
    ),
  ];
  const formIds = new Set<string>();
  if (linkedLibraryIds.length > 0) {
    const { data: withForms } = await createAdminClient()
      .from("document_library_items")
      .select("id")
      .in("id", linkedLibraryIds)
      .not("template_file_path", "is", null);
    for (const row of withForms || []) formIds.add(row.id);
  }

  // Certificates stay downloadable here for three weeks after the whole
  // OC is issued; after that the portal stops being a document library
  // and a further copy is asked for. See lib/portalAccess.
  const canDownloadCertificates = certificatesDownloadable(ocRecords || []);
  const closedNotice = accessClosedNotice(ocRecords || []);

  const pathwayItems = (pathwayChecklist?.checklist_items as ItemWithAmendments[]) || [];
  const nocItems = (nocChecklist?.checklist_items as ItemWithAmendments[]) || [];
  const ocItems = (ocChecklist?.checklist_items as ItemWithAmendments[]) || [];

  // The OC stage only opens once the Notice of Commencement is done —
  // every NOC item approved. A job whose certifier hasn't put anything on
  // the NOC checklist has nothing to complete, so it doesn't lock the OC.
  const nocComplete = nocItems.length > 0 && nocItems.every((i) => i.status === "approved");
  const ocLocked = nocItems.length > 0 && !nocComplete;

  // A PC/OC-only job has no CDC or CC: its pathway checklist is the PC
  // appointment paperwork, so the first tab says so.
  const approvalLabel = job.pathway === "PC_OC" ? "PC Appointment" : pathwayLabel(job.pathway);
  const stage = stageParam === "noc" || stageParam === "oc" || stageParam === "inspections" ? stageParam : "approval";

  // Inspections can only be booked once the Notice of Commencement
  // checklist is complete: building work does not start on the day the
  // certificate is issued, it starts once the Notice has been given.
  // Refused by the database too — see migration 0048.
  const jobInspections = (inspections as (Inspection & { defects: Defect[] })[]) || [];
  const bookingOpen = inspectionBookingOpen(nocItems);

  const tabs: { key: string; label: string; done: boolean; locked?: boolean }[] = [
    // Green once there is nothing left for the client to do here: every
    // document approved, or the certificate already in their hands.
    { key: "approval", label: approvalLabel, done: !!job.pathway_sent_to_client || (pathwayItems.length > 0 && pathwayItems.every((i) => i.status === "approved")) },
    { key: "noc", label: "PC — Notice of Commencement", done: nocComplete },
    // Done once every inspection has an outcome — nothing left to attend.
    { key: "inspections", label: "Inspections", done: jobInspections.length > 0 && jobInspections.every((i) => i.outcome !== "pending") },
    { key: "oc", label: "Occupation Certificate", done: (ocRecords || []).some((r) => r.sent_to_client), locked: ocLocked },
  ];

  const approvalPanel = (
        <div className="space-y-6">
          <StageSection title={`${approvalLabel} — checklist`} items={pathwayItems} jobId={id} firmId={job.firm_id} formIds={formIds} />
          {pathwayItems.length === 0 && !job.pathway_sent_to_client && <EmptyStage label={approvalLabel} />}

          {job.pathway_sent_to_client && (
            <div className="bg-white rounded-lg border border-line p-5">
              <div className="font-bold text-primary mb-1">{pathwayLabel(job.pathway)} certificate issued</div>
              <div className="text-xs text-placeholder mb-3">Issued {formatISODate(job.pathway_generated_date)}</div>
              {/* The certifier's own uploaded copy wins when there is one — it's
                  the version they actually edited and signed off. Falling back to
                  the generated certificate means a released certificate is always
                  downloadable: previously, forgetting to upload left the client
                  with nothing but "not yet uploaded", even though the certificate
                  had been issued and sent. */}
              {!canDownloadCertificates ? (
                <div className="text-sm text-muted">{closedNotice}</div>
              ) : job.pathway_approval_uploaded && pathwayApprovalUrl ? (
                <a href={pathwayApprovalUrl} target="_blank" rel="noreferrer" className="text-sm text-primary font-semibold hover:underline">
                  Download certificate
                </a>
              ) : (
                <a href={`/api/portal/certificate/pathway/${job.id}/pdf`} className="text-sm text-primary font-semibold hover:underline">
                  Download certificate
                </a>
              )}
            </div>
          )}

          {(modifications || []).map((m) => (
            <StageSection
              key={m.id}
              title={`Modification${m.reason ? ` — ${m.reason}` : ""}`}
              items={(modChecklists.get(m.id)?.checklist_items as ItemWithAmendments[]) || []}
              jobId={id}
              firmId={job.firm_id}
              formIds={formIds}
              footer={m.generated ? `Issued ${formatISODate(m.generated_date)}` : undefined}
            />
          ))}
        </div>
  );

  const nocPanel = (
        <div className="space-y-6">
          <StageSection title="Notice of Commencement (NOC) — checklist" items={nocItems} jobId={id} firmId={job.firm_id} formIds={formIds} />
          {nocItems.length === 0 && <EmptyStage label="Notice of Commencement" />}
        </div>
  );

  const inspectionsPanel = (
        <InspectionsSection
          jobId={id}
          pathwayGenerated={job.pathway_generated}
          inspections={jobInspections}
          certifiers={certifiers || []}
          bookingOpen={bookingOpen}
          nocProgress={checklistProgress(nocItems)}
          contact={firmContact}
        />
  );

  // Not rendered at all while locked — the lock panel lives in StageTabs.
  const ocPanel = ocLocked ? null : (
          <div className="space-y-6">
            <StageSection title="Occupation Certificate — checklist" items={ocItems} jobId={id} firmId={job.firm_id} formIds={formIds} />
            {ocItems.length === 0 && (ocRecords || []).filter((r) => r.sent_to_client).length === 0 && <EmptyStage label="Occupation Certificate" />}

            <OcSection ocRecords={(ocRecords || []).filter((r) => r.sent_to_client)} canDownload={canDownloadCertificates} closedNotice={closedNotice} />
          </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/portal" className="text-xs text-placeholder hover:text-primary">
            ← All projects
          </Link>
          <h1 className="text-xl font-bold text-primary mt-1">{job.address}</h1>
          <div className="text-sm text-placeholder">
            {pathwayLabel(job.pathway)} · {job.description}
          </div>
        </div>
        {/* The whole checklist as a document to keep or forward — the
            page it opens carries its own Save as PDF. */}
        <Link
          href={`/portal/jobs/${id}/checklist`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-primary/50 text-primary bg-white text-sm font-semibold hover:bg-surface shrink-0"
        >
          <FileDown size={16} /> Checklist PDF
        </Link>
      </div>

      {/* Directly under the header, beside the Checklist PDF button
          rather than at the foot of the page: an unpaid invoice is
          something the client is being asked to act on, and asking for
          it below three checklists is asking quietly. */}
      <PortalInvoices invoices={invoices} title="Invoices for this project" />

      <StageTabs
        tabs={tabs}
        initialStage={stage}
        ocLocked={ocLocked}
        nocProgress={checklistProgress(nocItems)}
        panels={{ approval: approvalPanel, noc: nocPanel, inspections: inspectionsPanel, oc: ocPanel }}
      />

      <div className="text-[11px] text-placeholder text-center">Signed in as {profile.email}</div>
    </div>
  );
}

function EmptyStage({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-lg border border-line p-6 text-sm text-muted text-center">
      Nothing is needed from you for the {label} stage yet — your certifier will add items here when they are.
    </div>
  );
}

async function StageSection({
  title,
  items,
  jobId,
  firmId,
  formIds,
  footer,
}: {
  title: string;
  items: ItemWithAmendments[];
  jobId: string;
  firmId: string;
  // Library item ids that actually have a blank form attached.
  formIds: Set<string>;
  footer?: string;
}) {
  if (items.length === 0) return null;
  const progress = checklistProgress(items);

  return (
    <div className="bg-white rounded-lg border border-line">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <div className="font-bold text-primary">{title}</div>
        {progress && <span className="text-xs text-placeholder">{progress} approved</span>}
      </div>
      <div className="p-5 space-y-3">
        {items.map((item) => {
          const status = displayStatus(item);
          const unresolved = item.amendments.filter((a) => !a.resolved);
          // The card wears the document's state: blue once submitted and
          // waiting on the certifier, green once approved, fully amber
          // while requested changes wait on the client — that one is the
          // card asking the client to act, so it dresses as a warning.
          const amendment = status.dot.includes("amber");
          const tone = status.dot.includes("emerald")
            ? "border-accent/40 bg-success-bg"
            : amendment
              ? "border-warning bg-warning-bg"
              : status.dot.includes("blue")
                ? "border-info/40 bg-info-bg"
                : "border-line bg-white";
          // Where a file dropped on the whole card should land: the first
          // document when none exists, a new version when there is exactly
          // one, nowhere when there are two (the per-document buttons
          // disambiguate; the card itself won't guess).
          const docs = currentDocuments(item);
          const dropNo = docs.length === 0 ? 1 : docs.length === 1 ? docs[0].documentNo : null;
          // One upload, then the item locks: a submitted document waits
          // for the certifier, and only a requested change (an unresolved
          // amendment) reopens uploading — as a new version of the same
          // document. Approval locks it for good.
          const canUpload = item.status !== "approved" && (docs.length === 0 || unresolved.length > 0);
          return (
            <ItemDropCard
              key={item.id}
              itemId={item.id}
              pathPrefix={`${firmId}/${jobId}/checklist/${item.id}`}
              documentNo={dropNo}
              enabled={canUpload && dropNo !== null}
              label={docs.length === 0 ? "Drop to upload" : "Drop to upload a new version"}
              className={`border rounded-md p-4 ${tone}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                <span className="text-sm font-semibold text-primary">{item.title}</span>
              </div>
              <div className="text-xs text-placeholder mt-0.5">{item.description}</div>
              <div className={`text-sm mt-1 font-semibold ${amendment ? "text-warning-text" : "text-muted"}`}>
                {amendment && <AlertTriangle size={14} className="inline -mt-0.5 mr-1" />}
                {status.label}
              </div>

              {/* On the amber card the notes go white with an amber edge,
                  so each requested change reads as its own instruction
                  rather than dissolving into the card's tint. */}
              {unresolved.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {unresolved.map((a) => (
                    <div key={a.id} className="text-sm font-medium bg-white border-l-4 border-warning text-warning-text rounded-md px-3 py-2">
                      {a.text}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-4">
                {/* The certifier's own blank form for this document, where
                    they've attached one: the contract, the application
                    form, the notice of commencement. Download it, fill it
                    in, and upload it back with the button beside it. */}
                {item.template_library_item_id && formIds.has(item.template_library_item_id) && (
                  <a
                    href={`/api/forms/${item.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline"
                  >
                    <Download size={14} /> Download blank form
                  </a>
                )}
              </div>

              {/* What has already been sent for this item — every document
                  on it, each with its own history, so a client can check
                  what the certifier is holding before sending more. */}
              <ClientItemDocuments item={item} jobId={jobId} firmId={firmId} canUpload={canUpload} />
            </ItemDropCard>
          );
        })}
      </div>
      {footer && <div className="px-5 pb-4 text-xs text-success">{footer}</div>}
    </div>
  );
}

async function InspectionsSection({
  jobId,
  pathwayGenerated,
  inspections,
  certifiers,
  bookingOpen,
  nocProgress,
  contact,
}: {
  jobId: string;
  pathwayGenerated: boolean;
  inspections: (Inspection & { defects: Defect[] })[];
  certifiers: Certifier[];
  // Booking waits on the Notice of Commencement — see migration 0048.
  bookingOpen: boolean;
  nocProgress: string | null;
  // How to reach the firm, for a date already agreed.
  contact: { phone?: string | null; email?: string | null } | null;
}) {
  if (!pathwayGenerated) {
    return (
      <div className="bg-white rounded-lg border border-line p-6 text-sm text-muted text-center">
        Inspections are listed here once your certificate has been issued.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Said once, at the top, rather than repeated under every
          inspection: the reason no dates can be chosen yet. */}
      {!bookingOpen && (
        <div className="bg-warning-bg border border-warning rounded-lg px-5 py-4">
          <div className="text-sm font-semibold text-warning-text">Booking opens once the Notice of Commencement is complete</div>
          <div className="text-sm text-warning-text mt-1">
            Building work cannot start until the Notice of Commencement of Work has been issued, so inspections cannot be booked until then. Provide the
            outstanding documents on the <strong>PC — Notice of Commencement</strong> tab
            {nocProgress ? ` (${nocProgress} approved so far)` : ""} and booking opens here automatically.
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-line">
        <div className="px-5 py-3 border-b border-line font-bold text-primary">Inspections</div>
        <div className="p-5 space-y-3">
          {inspections.map((insp) => {
            const inspector = certifiers.find((c) => c.id === insp.inspector_certifier_id);
            // The person actually attending, where one is assigned and
            // has a mobile on file. A builder whose slab is not ready
            // wants them, not the office.
            const reach = inspector?.mobile?.trim()
              ? { phone: inspector.mobile, email: contact?.email ?? null }
              : contact;
            return <InspectionCard key={insp.id} insp={insp} jobId={jobId} inspectorName={inspector?.name} bookingOpen={bookingOpen} contact={reach} />;
          })}
          {inspections.length === 0 && (
            <div className="py-6 text-center text-sm text-muted">Your certifier hasn&rsquo;t scheduled any inspections for this project yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// A date already agreed is not moved from a form: the certifier has
// planned a day's run around it, so changing it is a conversation. Which
// means giving them something to reach — telling somebody to ring
// without a number is how a change of date becomes a missed inspection.
function ChangeOfDate({ contact }: { contact: { phone?: string | null; email?: string | null } | null }) {
  const phone = contact?.phone?.trim();
  const email = contact?.email?.trim();
  if (!phone && !email) return <>To change it, call or email us.</>;

  return (
    <>
      To change it,{" "}
      {phone && (
        <>
          call{" "}
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className="font-semibold underline">
            {phone}
          </a>
        </>
      )}
      {phone && email ? " or " : ""}
      {email && (
        <>
          email{" "}
          <a href={`mailto:${email}`} className="font-semibold underline">
            {email}
          </a>
        </>
      )}
      .
    </>
  );
}

const BOOKING_STAGE_STYLE: Record<string, string> = {
  not_booked: "bg-surface text-muted",
  awaiting_confirmation: "bg-warning-bg text-warning-text",
  confirmed: "bg-success-bg text-success",
};

async function InspectionCard({
  insp,
  jobId,
  inspectorName,
  bookingOpen,
  contact,
}: {
  insp: Inspection & { defects: Defect[] };
  jobId: string;
  inspectorName?: string;
  bookingOpen: boolean;
  contact: { phone?: string | null; email?: string | null } | null;
}) {
  // The signed report the certifier produced on site comes first; an
  // uploaded file is the fallback for a report done outside Certlyn.
  // Reading only the uploaded path is why a report signed in the app
  // never appeared here at all.
  const reportUrl = await signedUrl(insp.report_pdf_path || insp.report_file_path);
  const stage = bookingStage(insp);
  // The badge says where the booking is until there is an outcome, and
  // what was found after that.
  const meta =
    stage === "carried_out"
      ? OUTCOME_META[insp.outcome]
      : { label: BOOKING_STAGE_LABEL[stage], style: BOOKING_STAGE_STYLE[stage] };
  // One request per inspection. Asking again while the first is still
  // with the certifier would silently overwrite the date they are about
  // to confirm, and a client with no way to tell whether the first
  // request landed will ask again.
  const canBook = stage === "not_booked" && bookingOpen;

  return (
    <div className="border border-line rounded-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-primary">{insp.title}</div>
          <div className="text-xs text-placeholder">{insp.description}</div>
          {insp.date && <div className="text-xs text-muted mt-1">Scheduled: {formatISODate(insp.date)}</div>}
          {inspectorName && <div className="text-xs text-placeholder">Inspector: {inspectorName}</div>}
        </div>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold min-w-0 text-right ${meta.style}`}>{meta.label}</span>
      </div>

      {insp.defects.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {insp.defects.map((d) => (
            <div key={d.id} className={`text-xs rounded-md px-3 py-2 ${d.resolved ? "bg-surface text-placeholder line-through" : "bg-warning-bg text-warning-text"}`}>
              {d.text}
            </div>
          ))}
        </div>
      )}

      {canBook && (
        <div className="mt-3">
          <BookInspectionForm inspectionId={insp.id} jobId={jobId} />
          <div className="text-[11px] text-placeholder mt-1">{BOOKING_RULE_NOTE}</div>
        </div>
      )}
      {stage === "awaiting_confirmation" && (
        <div className="text-xs text-warning-text mt-2 bg-warning-bg rounded-md px-3 py-2">
          You asked for <strong>{formatISODate(insp.date)}</strong>. Your certifier will confirm it or offer another day, and this page will update.
        </div>
      )}
      {stage === "confirmed" && (
        <div className="text-xs text-success mt-2 bg-success-bg rounded-md px-3 py-2">
          Confirmed for <strong>{formatISODate(insp.date)}</strong>. Please have the site ready and accessible on the day.{" "}
          <ChangeOfDate contact={contact} />
        </div>
      )}

      {insp.report_sent && reportUrl && (
        <a href={reportUrl} target="_blank" rel="noreferrer" className="inline-block mt-3 text-xs text-primary font-semibold hover:underline">
          View inspection report
        </a>
      )}
    </div>
  );
}

async function OcSection({ ocRecords, canDownload, closedNotice }: { ocRecords: OcRecord[]; canDownload: boolean; closedNotice: string }) {
  if (ocRecords.length === 0) return null;
  return (
    <div className="bg-white rounded-lg border border-line">
      <div className="px-5 py-3 border-b border-line font-bold text-primary">Occupation Certificates</div>
      <div className="p-5 space-y-3">
        {!canDownload && <div className="text-sm text-muted">{closedNotice}</div>}
        {ocRecords.map((r) => (
          <OcRecordCard key={r.id} record={r} canDownload={canDownload} />
        ))}
      </div>
    </div>
  );
}

async function OcRecordCard({ record, canDownload }: { record: OcRecord; canDownload: boolean }) {
  const url = await signedUrl(record.approval_file_path);
  return (
    <div className="border border-line rounded-md p-4">
      <div className="text-sm font-semibold text-primary">
        {record.type === "whole" ? "Whole OC" : "Partial OC"} {record.description ? `— ${record.description}` : ""}
      </div>
      <div className="text-xs text-placeholder">Issued {formatISODate(record.generated_date)}</div>
      {!canDownload ? null : (
        <div className="mt-2 flex items-center gap-4 flex-wrap">
          {record.approval_uploaded && url ? (
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary font-semibold hover:underline">
              Download certificate
            </a>
          ) : (
            <a href={`/api/portal/certificate/oc/${record.job_id}/${record.id}/pdf`} className="text-xs text-primary font-semibold hover:underline">
              Download certificate
            </a>
          )}
          {/* The whole thing as one PDF: the certificate, the documents
              it relied on, and every inspection report behind them. */}
          <a href={`/api/portal/certificate/oc/${record.job_id}/${record.id}/set`} className="text-xs text-primary font-semibold hover:underline">
            Download full set (with inspection reports)
          </a>
        </div>
      )}
    </div>
  );
}
