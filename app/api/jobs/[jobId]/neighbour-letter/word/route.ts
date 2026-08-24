import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { formatISODate, todayISO } from "@/lib/business";
import { formatAddress } from "@/lib/certificates/pathwayData";
import { resolveStampCertifier } from "@/lib/pdf/stampDetails";
import { fetchImageAsset } from "@/lib/docx/fetchImageAsset";
import { buildNeighbourLetterDocx } from "@/lib/docx/neighbourLetters";
import type { Job, Firm } from "@/types/db";

// The s134 neighbour notification letter as a Word file, built entirely
// from what the job already records — site address, proposed development,
// applicant contact details — so there is nothing extra to type in.
// Available from the moment the job exists: this notice goes out when the
// application is received, well before anything is issued.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!rawJob) return NextResponse.json({ error: "not found" }, { status: 404 });
  const job = rawJob as Job;
  const d = job.details || {};

  const { data: firm } = await supabase.from("firms").select("*").eq("id", profile.firm_id).single();
  const typedFirm = (firm || null) as Firm | null;
  const certifier = await resolveStampCertifier(supabase, job, profile);

  const [logo, signature] = await Promise.all([
    fetchImageAsset(await signedUrl(typedFirm?.logo_url), 64, 190),
    fetchImageAsset(await signedUrl(certifier?.signature_url), 68, 240),
  ]);

  // The applicant details the letter offers neighbours, resolved the same
  // way the certificate resolves its applicant.
  const applicantName = [d.contact?.title, d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ") || d.contact?.nameOrCompany || "";
  const projRef = d.projectNumber || job.id.slice(0, 8);

  const buffer = await buildNeighbourLetterDocx(
    {
      firm: typedFirm,
      certifier,
      jobAddress: job.address || "",
      description: job.description || "",
      applicantName,
      applicantPhone: d.contact?.phone || d.contact?.mobile || "",
      applicantEmail: d.contact?.email || "",
      applicantAddress: formatAddress(d.applicantAddress),
      // The same instrument the certificate itself names — computed from
      // the ticked code parts, so both documents cite the same law.
      relevantInstrument: d.certificateDetails?.relevantInstrument || "",
      relevantPartOfCode: d.certificateDetails?.relevantPartOfCode || "",
      projRef,
      issuedDate: formatISODate(todayISO()),
    },
    { logo, signature }
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${projRef}-Neighbour-Notification.docx"`,
    },
  });
}
