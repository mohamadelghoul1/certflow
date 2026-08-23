import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { getQuoteDocumentData } from "@/lib/quotes/quoteData";
import { fetchImageAsset } from "@/lib/docx/fetchImageAsset";
import { buildQuoteDocx } from "@/lib/docx/quoteDocument";

// A real .docx of the fee proposal, generated server-side — the same
// approach as the certificate package's Word export, replacing the old
// client-side HTML-cloning download that Word rendered unstyled.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile("certifier");

  const data = await getQuoteDocumentData(id, profile.firm_id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const logo = await fetchImageAsset(data.logoUrl, 64, 190);
  const buffer = await buildQuoteDocx(data, { logo });

  const safeNumber = data.quoteNumber.replace(/[^\w-]+/g, "-");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Quote-${safeNumber}.docx"`,
    },
  });
}
