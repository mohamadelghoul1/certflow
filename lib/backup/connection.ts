import { createAdminClient } from "@/lib/supabase/admin";
import { needsRefresh, providerFor, type CloudProvider, type ProviderId, type Tokens } from "@/lib/backup/providers";

// The stored link between a firm and its cloud storage.
//
// These rows hold live access tokens to a firm's own Dropbox or OneDrive.
// Nothing in the browser has any reason to read them, so the table has
// row level security with no policy at all — everything here goes through
// the service role, on the server.

export type Connection = {
  id: string;
  firm_id: string;
  provider: ProviderId;
  account_label: string | null;
  root_folder: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  connected_at: string;
  last_sync_at: string | null;
  last_sync_error: string | null;
};

// What the firm is allowed to see about a connection: which account, when
// it was connected, how the last run went. Never the tokens.
export type ConnectionStatus = Pick<Connection, "id" | "provider" | "account_label" | "root_folder" | "connected_at" | "last_sync_at" | "last_sync_error">;

export function credentialsFor(provider: ProviderId) {
  const clientId = provider === "dropbox" ? process.env.DROPBOX_CLIENT_ID : process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = provider === "dropbox" ? process.env.DROPBOX_CLIENT_SECRET : process.env.ONEDRIVE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

// Which providers this deployment has been given credentials for, so the
// settings page offers only what can actually be connected rather than a
// button that fails after the firm has already left the app.
export function configuredProviders(): ProviderId[] {
  return (["dropbox", "onedrive"] as ProviderId[]).filter((p) => credentialsFor(p) !== null);
}

export function redirectUriFor(provider: ProviderId, origin: string) {
  return `${origin}/api/backup/${provider}/callback`;
}

function tokensFrom(payload: Record<string, unknown>): Tokens {
  const expiresIn = Number(payload.expires_in);
  return {
    accessToken: String(payload.access_token || ""),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : null,
    expiresAt: Number.isFinite(expiresIn) ? new Date(Date.now() + expiresIn * 1000) : null,
  };
}

export async function exchangeCode(provider: CloudProvider, redirectUri: string, code: string): Promise<Tokens> {
  const credentials = credentialsFor(provider.id);
  if (!credentials) throw new Error(`${provider.label} is not configured on this deployment.`);

  const { url, body } = provider.tokenRequest({ ...credentials, redirectUri, code });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new Error(`${provider.label} refused the connection (${res.status}). ${await res.text()}`);
  return tokensFrom(await res.json());
}

// The access token to use right now, refreshing it first if it is close
// to expiry. A token that dies mid-run fails every file after it, so the
// refresh happens before the run rather than in response to a failure.
export async function usableAccessToken(connection: Connection): Promise<string> {
  if (!needsRefresh(connection.expires_at ? new Date(connection.expires_at) : null)) return connection.access_token;

  const provider = providerFor(connection.provider);
  const credentials = credentialsFor(connection.provider);
  if (!provider || !credentials || !connection.refresh_token) return connection.access_token;

  const { url, body } = provider.refreshRequest({ ...credentials, refreshToken: connection.refresh_token });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new Error(`${provider.label} would not renew the connection (${res.status}). Reconnect it in Settings.`);

  const tokens = tokensFrom(await res.json());
  const admin = createAdminClient();
  await admin
    .from("cloud_backup_connections")
    .update({
      access_token: tokens.accessToken,
      // Providers do not always return a new refresh token; keeping the
      // old one is what stops a renewal from ending the connection.
      refresh_token: tokens.refreshToken || connection.refresh_token,
      expires_at: tokens.expiresAt?.toISOString() || null,
    })
    .eq("id", connection.id);

  return tokens.accessToken;
}

export async function accountLabel(provider: CloudProvider, accessToken: string): Promise<string> {
  try {
    const request = provider.accountRequest({ accessToken });
    const res = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body });
    if (!res.ok) return `${provider.label} account`;
    return provider.accountLabelFrom(await res.json());
  } catch {
    return `${provider.label} account`;
  }
}
