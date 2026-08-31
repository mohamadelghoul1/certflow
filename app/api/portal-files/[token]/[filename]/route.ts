import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPortalFileToken } from "@/lib/portal/files";

// Serves one document to the NSW Planning Portal's downloader.
//
// Public by design — the Portal holds no Certlyn login — but the token
// in the path is the authority: it names exactly one storage file and an
// expiry, sealed server-side, so the route can serve nothing it wasn't
// asked to. The filename segment exists so the link ends the way a file
// should; the token alone decides what is served.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string; filename: string }> }) {
  const { token, filename } = await params;
  const storagePath = verifyPortalFileToken(token);
  if (!storagePath) return new NextResponse("This link has expired.", { status: 410 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("certflow-files").download(storagePath);
  if (error || !data) return new NextResponse("Not found.", { status: 404 });

  const name = decodeURIComponent(filename);
  // Taken from the sealed path, not the filename in the URL: the token
  // decides what is served, so it should decide what it is called as
  // well. A caller could otherwise ask for a PDF under a .png name and
  // have it labelled as an image.
  const contentType = storagePath.endsWith(".pdf") ? "application/pdf" : storagePath.endsWith(".png") ? "image/png" : "image/jpeg";
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${name.replace(/[^\x20-\x7e]/g, "-").replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
