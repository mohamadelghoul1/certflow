import { type PortalConfig } from "@/lib/portal/config";

// The one place CertFlow actually talks to the NSW Planning Portal.
//
// Every call carries the api-key and the registered organisation name,
// per the department's specification. Nothing here decides *what* to
// send — that lives in lib/portal/inspections.ts where it is tested
// against the schemas — this only carries it.

export type PortalCallResult = {
  ok: boolean;
  status: number;
  // The raw response text, kept whole: the Portal's answers carry the
  // case ids and error reasons as prose, and the audit log stores this
  // verbatim so a failed send can be diagnosed after the fact.
  body: string;
};

export async function callPortal(config: PortalConfig, method: "POST" | "PUT", path: string, body: unknown): Promise<PortalCallResult> {
  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey,
        organisationID: config.organisationId,
      },
      body: JSON.stringify(body),
      // A hung government gateway must not hang the certifier's screen.
      signal: AbortSignal.timeout(30_000),
    });
    return { ok: res.ok, status: res.status, body: await res.text() };
  } catch (error) {
    return { ok: false, status: 0, body: error instanceof Error ? error.message : String(error) };
  }
}

// The Portal answers InitiateInspection with the new inspection case's id
// carried in the response rather than as a defined field. Looked for in
// the likely places: a JSON field under a few plausible names, then the
// "CaseID--XXX" phrasing the specification's own example uses.
export function extractChildCaseId(responseBody: string): string | null {
  try {
    const parsed = JSON.parse(responseBody);
    for (const key of ["childCaseID", "childCaseId", "caseID", "caseId", "CaseID", "inspectionCaseId"]) {
      const value = parsed?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    if (typeof parsed?.description === "string") {
      const fromDescription = matchCaseId(parsed.description);
      if (fromDescription) return fromDescription;
    }
  } catch {
    // Not JSON — fall through to reading it as text.
  }
  return matchCaseId(responseBody);
}

function matchCaseId(text: string): string | null {
  const match = /CaseID\s*[-–—:]+\s*([A-Za-z0-9/_-]+)/i.exec(text);
  return match ? match[1] : null;
}
