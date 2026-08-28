import { escapeHtml } from "@/lib/html";
import { pathwayFullLabel, type Pathway } from "@/lib/business";

// The email a client gets when their certificate is issued.
//
// It used to say one sentence — "Your CDC has been issued and is now
// available to view in your portal" — and stop there, which left the
// most important thing unsaid. A CDC is not permission to start
// building: the Notice of Commencement has to be issued first, and that
// cannot happen until the client provides what the NOC checklist asks
// for. A client who is not told that reads "issued" as "go ahead", and
// the first anyone hears of it is a call about work already underway.
//
// So the email names the documents still outstanding, by name, and says
// plainly what they unlock.

export type CertificateIssuedEmail = { subject: string; html: string };

export function certificateIssuedEmail(opts: {
  pathway: Pathway;
  address: string | null;
  firmName?: string | null;
  // The NOC checklist items not yet approved, in checklist order.
  outstanding: string[];
}): CertificateIssuedEmail {
  const { pathway, address, firmName, outstanding } = opts;
  const full = pathwayFullLabel(pathway);
  const site = (address || "").trim();
  const parts: string[] = [];

  parts.push(
    `<p>Your ${escapeHtml(full)} (${escapeHtml(pathway)})${site ? ` for <strong>${escapeHtml(site)}</strong>` : ""} has been issued. A copy is available to download from your portal at any time.</p>`
  );

  parts.push(`<p style="margin-top:20px"><strong>Next step — Notice of Commencement of Work</strong></p>`);

  if (outstanding.length > 0) {
    parts.push(
      `<p>Before we can issue the Notice of Commencement of Work, the following must be provided through your portal:</p>`,
      `<ul style="margin:8px 0 12px;padding-left:20px">${outstanding.map((item) => `<li style="margin-bottom:4px">${escapeHtml(item)}</li>`).join("")}</ul>`
    );
  } else {
    parts.push(
      `<p>Before we can issue the Notice of Commencement of Work, please provide the documents listed under <strong>PC — Notice of Commencement</strong> in your portal.</p>`
    );
  }

  parts.push(
    `<p>Once each item has been provided and reviewed, we will issue the Notice of Commencement of Work and give Council the notice required.</p>`,
    // The one sentence this email exists for.
    `<p><strong>Building work must not commence until the Notice of Commencement of Work has been issued.</strong></p>`,
    `<p style="margin-top:20px">If anything on the list is unclear, or you believe an item does not apply to this project, please contact us before proceeding.</p>`,
    `<p>Kind regards,<br/>${escapeHtml(firmName || "")}</p>`
  );

  return {
    subject: site ? `${pathway} issued — ${site}` : `${pathway} issued`,
    html: parts.join(""),
  };
}
