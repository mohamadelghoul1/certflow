import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { providerFor } from "@/lib/backup/providers";
import { credentialsFor, redirectUriFor } from "@/lib/backup/connection";

// Sends the certifier to Dropbox or Microsoft to authorise the backup.
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const { profile } = await requireProfile("certifier");

  const provider = providerFor(providerId);
  const credentials = provider ? credentialsFor(provider.id) : null;
  if (!provider || !credentials) return NextResponse.redirect(new URL("/settings?section=backup&backup=unavailable", request.url));

  // The state ties the callback back to the firm that started it, and is
  // checked on the way back in — without it, anyone could hand us a code
  // and have it attached to somebody else's firm.
  const state = `${profile.firm_id}.${crypto.randomUUID()}`;
  const response = NextResponse.redirect(
    provider.authorizeUrl({ clientId: credentials.clientId, redirectUri: redirectUriFor(provider.id, request.nextUrl.origin), state })
  );
  response.cookies.set(`backup_state_${provider.id}`, state, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 600, path: "/" });
  return response;
}
