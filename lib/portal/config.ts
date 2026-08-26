// The NSW Planning Portal (ePlanning) connection.
//
// Everything secret lives in Vercel's environment variables, set by hand
// there and nowhere else. Until they are set, the app treats the Portal
// as not connected and none of these calls are attempted.
//
// The base URL points at the government's TEST environment on purpose.
// Production is an explicit opt-in via the environment variable, so no
// amount of development or testing can touch real Portal cases by
// accident.

export const PORTAL_UAT_BASE = "https://api-uat.apps1.nsw.gov.au/planning/PCCMgmt/Certifiers/v1";
export const PORTAL_PROD_BASE = "https://api.apps1.nsw.gov.au/planning/PCCMgmt/Certifiers/v1";

export type PortalConfig = {
  baseUrl: string;
  apiKey: string;
  // The Private Certifier Organisation name registered with ePlanning —
  // sent on every call so the Portal knows who is talking.
  organisationId: string;
};

export function portalConfig(): PortalConfig | null {
  const apiKey = process.env.PLANNING_PORTAL_API_KEY;
  const organisationId = process.env.PLANNING_PORTAL_ORGANISATION_ID;
  if (!apiKey || !organisationId) return null;
  return {
    baseUrl: process.env.PLANNING_PORTAL_BASE_URL || PORTAL_UAT_BASE,
    apiKey,
    organisationId,
  };
}

export function portalConfigured(): boolean {
  return portalConfig() !== null;
}
