import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerFor } from "@/lib/backup/providers";
import { accountLabel, exchangeCode, redirectUriFor } from "@/lib/backup/connection";

// Where Dropbox or Microsoft sends the certifier back to, with a code to
// exchange for the tokens that let CertFlow write to their storage.
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const { profile, userId } = await requireProfile("certifier");
  const settings = (outcome: string) => NextResponse.redirect(new URL(`/settings?backup=${outcome}`, request.url));

  const provider = providerFor(providerId);
  if (!provider) return settings("unavailable");

  // The provider hands back whatever we sent it. Checking it against the
  // cookie is what makes the code trustworthy: without it, a code from
  // anywhere could be attached to this firm's account.
  const expected = request.cookies.get(`backup_state_${provider.id}`)?.value;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !state || !expected || state !== expected || !state.startsWith(`${profile.firm_id}.`)) return settings("failed");

  try {
    const tokens = await exchangeCode(provider, redirectUriFor(provider.id, request.nextUrl.origin), code);
    const label = await accountLabel(provider, tokens.accessToken);

    const admin = createAdminClient();
    await admin.from("cloud_backup_connections").upsert(
      {
        firm_id: profile.firm_id,
        provider: provider.id,
        account_label: label,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt?.toISOString() || null,
        connected_by: userId,
        connected_at: new Date().toISOString(),
        last_sync_error: null,
      },
      { onConflict: "firm_id,provider" }
    );

    const response = settings("connected");
    response.cookies.delete(`backup_state_${provider.id}`);
    return response;
  } catch {
    return settings("failed");
  }
}
