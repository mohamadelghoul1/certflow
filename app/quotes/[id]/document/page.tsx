import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { today } from "@/lib/business";
import { getQuoteDocumentData } from "@/lib/quotes/quoteData";
import { QuoteDocument, QuoteTermsEditor } from "@/components/certifier/QuoteDocument";

export default async function QuoteDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getQuoteDocumentData(id, profile.firm_id);
  if (!data) notFound();
  const { quote, feeLines, firm: firmData, applicant, certifierName, subtotal, gst, total, pathwayFull, validUntil, validityLine, activeTerms, quoteNumber, logoUrl } = data;

  // The logo is embedded as data rather than linked by its signed URL, so
  // a printed or saved copy of this page keeps showing it long after the
  // URL would have expired.
  let logoSrc: string | null = null;
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        logoSrc = `data:${res.headers.get("content-type") || "image/png"};base64,${buffer.toString("base64")}`;
      }
    } catch {
      // The page still renders with the firm name alone.
    }
  }

  const mailtoTo = applicant.email || "";
  const mailtoSubject = `Fee Quote ${quoteNumber} — ${quote.proposal_address || "Your project"}`;
  const mailtoBody = [
    `Hi ${applicant.name || "there"},`,
    "",
    `Please find attached our fee quote for ${quote.proposal_address || "your project"}.`,
    `Total (incl. GST): $${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    `This quote is ${validUntil ? `valid until ${validUntil}` : `valid for ${quote.valid_for || "7 Days"} from the date of issue`}.`,
    "",
    "Please attach the quote document (downloaded via Export as Word or Print/Save as PDF) before sending.",
    "",
    "Kind regards,",
    certifierName || "",
    firmData?.name || "",
  ].join("\n");
  const mailtoHref = `mailto:${mailtoTo}?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(mailtoBody)}`;

  return (
    <QuoteDocument
      backHref={`/quotes/${id}`}
      wordHref={`/api/quotes/${id}/word`}
      mailtoHref={mailtoHref}
      hasApplicantEmail={!!applicant.email}
    >
      <div className="quote-doc max-w-2xl mx-auto p-8 bg-white text-heading print:max-w-none">
        <div className="flex justify-between items-start pb-3 mb-1">
          <div>
            {logoSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={`${firmData?.name || "Firm"} logo`} className="h-16 w-auto object-contain mb-3" />
            )}
            <div className="text-xl font-black tracking-tight">{firmData?.name}</div>
          </div>
          <div className="text-right text-xs text-muted leading-relaxed">
            <div className="font-bold">{firmData?.name} Pty Ltd</div>
            <div>{firmData?.office_address}</div>
            <div className="mt-1">Phone: {firmData?.phone}</div>
            <div className="text-info underline">{firmData?.email}</div>
            {firmData?.website && <div className="text-info underline">{firmData.website}</div>}
          </div>
        </div>
        <div className="border-b border-heading mb-4" />

        <div className="flex justify-between text-sm mb-6">
          <div>Quote Number: {quoteNumber}</div>
          <div>Date: {today()}</div>
        </div>

        <div className="text-center mb-6">
          <div className="font-bold">FEE PROPOSAL</div>
          <div className="font-bold">FOR</div>
          <div className="font-bold">{pathwayFull} and Principal Certifier Services</div>
        </div>

        <div className="text-sm mb-3">
          <u className="font-semibold">Property Address:</u> {quote.proposal_address || "—"}
        </div>
        <div className="text-sm mb-4">
          <u className="font-semibold">Job Description:</u> {quote.development_description || "—"}
        </div>

        <div className="text-sm font-semibold underline mb-2">Scope of Works</div>
        <ul className="list-disc pl-6 text-sm mb-6 space-y-0.5">
          {(quote.scope_of_works || []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>

        <table className="w-full mb-1 border border-line text-sm">
          <thead>
            <tr style={{ backgroundColor: "#B8B49A" }}>
              <th className="text-left font-semibold px-3 py-2 border border-line">Description</th>
              <th className="text-right font-semibold px-3 py-2 border border-line w-24">Fee</th>
            </tr>
          </thead>
          <tbody>
            {feeLines.map((l) => (
              <tr key={l.id}>
                {/* whitespace-pre-line keeps the line breaks typed into a
                    multi-line description. */}
                <td className="px-3 py-1.5 border border-line whitespace-pre-line">{l.description || "—"}</td>
                <td className="px-3 py-1.5 border border-line text-right align-top">{l.amount ? Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col items-end gap-0.5 text-sm mb-4">
          <div className="flex gap-4">
            <span className="text-placeholder">Subtotal:</span>
            <span>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-placeholder">GST:</span>
            <span>${gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex gap-4 font-bold">
            <span>Total:</span>
            <span>${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="text-sm font-bold underline mb-4">***Our fee is {validityLine}.</div>

        <QuoteTermsEditor quoteId={id} activeTerms={activeTerms} hasOverride={!!quote.terms_override} />

        <div className="text-sm mt-6">
          <div>Kind Regards</div>
          <div>{firmData?.name} Pty Ltd</div>
        </div>
      </div>
    </QuoteDocument>
  );
}
