// Talking to a firm's own cloud storage.
//
// Dropbox and Microsoft differ in how they authorise, how they name a
// path and how they take a large file, but the job is the same either
// way: put this file at this path. Everything specific to one of them is
// behind this interface, so the sync itself never mentions a provider.
//
// The request shapes here follow each provider's published API. They
// cannot be exercised from the build environment, so the parts that can
// be reasoned about — paths, arguments, which upload a file's size calls
// for, when a token needs refreshing — are separated out and tested, and
// the network calls are kept as thin as possible around them.

export type ProviderId = "dropbox" | "onedrive";

export type Tokens = {
  accessToken: string;
  refreshToken: string | null;
  // Absolute, not a lifetime: a duration is only meaningful next to the
  // moment it was issued, and that moment is not what gets stored.
  expiresAt: Date | null;
};

export type CloudProvider = {
  id: ProviderId;
  label: string;
  authorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string;
  tokenRequest(input: { clientId: string; clientSecret: string; redirectUri: string; code: string }): { url: string; body: URLSearchParams };
  refreshRequest(input: { clientId: string; clientSecret: string; refreshToken: string }): { url: string; body: URLSearchParams };
  uploadRequest(input: { accessToken: string; remotePath: string; size: number }): { url: string; method: string; headers: Record<string, string> };
  accountRequest(input: { accessToken: string }): { url: string; method: string; headers: Record<string, string>; body?: string };
  accountLabelFrom(payload: unknown): string;
  // Above this, the simple upload is refused and a chunked session is
  // required. Kept explicit because the two providers draw the line in
  // very different places.
  simpleUploadLimit: number;
};

// A path inside the firm's backup folder, as a single string with one
// leading slash and no trailing one. Both providers reject a doubled
// slash, and the folder names come from addresses and certificate
// references, so they routinely arrive with stray separators.
export function remotePath(rootFolder: string, ...segments: string[]) {
  const parts = [rootFolder, ...segments]
    .join("/")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return `/${parts.join("/")}`;
}

// Refreshed a little early rather than on the stroke of expiry: a token
// that dies mid-upload fails the file, and the clock here is not the
// clock that issued it.
export function needsRefresh(expiresAt: Date | null | undefined, now = new Date(), marginSeconds = 300) {
  if (!expiresAt) return false;
  return expiresAt.getTime() - now.getTime() <= marginSeconds * 1000;
}

export const DROPBOX: CloudProvider = {
  id: "dropbox",
  label: "Dropbox",
  // token_access_type=offline is what makes Dropbox return a refresh
  // token; without it the connection dies after a few hours and the firm
  // has to reconnect by hand.
  authorizeUrl: ({ clientId, redirectUri, state }) =>
    `https://www.dropbox.com/oauth2/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      token_access_type: "offline",
      state,
    })}`,
  tokenRequest: ({ clientId, clientSecret, redirectUri, code }) => ({
    url: "https://api.dropboxapi.com/oauth2/token",
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
  }),
  refreshRequest: ({ clientId, clientSecret, refreshToken }) => ({
    url: "https://api.dropboxapi.com/oauth2/token",
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
  }),
  uploadRequest: ({ accessToken, remotePath: path }) => ({
    url: "https://content.dropboxapi.com/2/files/upload",
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      // The path travels in a header as JSON, which is why it must not
      // contain a raw newline — Dropbox rejects the whole request.
      "Dropbox-API-Arg": JSON.stringify({ path, mode: "overwrite", autorename: false, mute: true, strict_conflict: false }),
    },
  }),
  accountRequest: ({ accessToken }) => ({
    url: "https://api.dropboxapi.com/2/users/get_current_account",
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  }),
  accountLabelFrom: (payload) => {
    const p = payload as { email?: string; name?: { display_name?: string } };
    return p?.email || p?.name?.display_name || "Dropbox account";
  },
  simpleUploadLimit: 150 * 1024 * 1024,
};

export const ONEDRIVE: CloudProvider = {
  id: "onedrive",
  label: "OneDrive",
  // offline_access is what makes Microsoft return a refresh token, the
  // same role token_access_type=offline plays for Dropbox.
  authorizeUrl: ({ clientId, redirectUri, state }) =>
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: "offline_access Files.ReadWrite User.Read",
      state,
    })}`,
  tokenRequest: ({ clientId, clientSecret, redirectUri, code }) => ({
    url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
  }),
  refreshRequest: ({ clientId, clientSecret, refreshToken }) => ({
    url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, scope: "offline_access Files.ReadWrite User.Read" }),
  }),
  // Graph puts the path in the URL between root: and :/content, so every
  // segment has to be escaped — an address with a space or a comma in it
  // otherwise produces a URL that means something else.
  uploadRequest: ({ accessToken, remotePath: path }) => ({
    url: `https://graph.microsoft.com/v1.0/me/drive/root:${path.split("/").map(encodeURIComponent).join("/")}:/content`,
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/octet-stream" },
  }),
  accountRequest: ({ accessToken }) => ({
    url: "https://graph.microsoft.com/v1.0/me",
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  }),
  accountLabelFrom: (payload) => {
    const p = payload as { mail?: string; userPrincipalName?: string; displayName?: string };
    return p?.mail || p?.userPrincipalName || p?.displayName || "OneDrive account";
  },
  simpleUploadLimit: 4 * 1024 * 1024,
};

export const PROVIDERS: Record<ProviderId, CloudProvider> = { dropbox: DROPBOX, onedrive: ONEDRIVE };

export function providerFor(id: string): CloudProvider | null {
  return PROVIDERS[id as ProviderId] || null;
}
