import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyEplanningDocId, eplanningAuthOk } from "@/lib/portal/files";

// Certlyn's registered inbound endpoint for the NSW Planning Portal's
// document downloader — the department's own "Get External Document"
// contract: GET {registered base}/Documents/{DocID}.
//
// Two gates, both required: the Basic Auth credentials lodged with
// ePlanning at registration, and the sealed DocID naming exactly one
// storage file. Everything and everyone else gets nothing.
export async function GET(request: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  if (!eplanningAuthOk(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorised.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Certlyn"' } });
  }

  const { docId } = await params;
  const storagePath = verifyEplanningDocId(docId);
  if (!storagePath) return new NextResponse("Unknown document.", { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("certflow-files").download(storagePath);
  if (error || !data) return new NextResponse("Document not found.", { status: 404 });

  const contentType = storagePath.endsWith(".pdf") ? "application/pdf" : storagePath.endsWith(".png") ? "image/png" : "image/jpeg";
  const name = storagePath.split("/").pop() || "document";
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "-").replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
