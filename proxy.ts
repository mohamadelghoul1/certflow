import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // api/portal-files is excluded outright: it serves documents to the
  // NSW Planning Portal's downloader, which holds no CertFlow login —
  // its authority is the sealed token inside the link itself.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/portal-files/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
