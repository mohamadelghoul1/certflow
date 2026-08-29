import { type PortalConfig } from "@/lib/portal/config";

// The one place Certlyn actually talks to the NSW Planning Portal.
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
  // The response headers too — a created case's number can travel there
  // rather than in the body.
  headers: Record<string, string>;
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
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return { ok: res.ok, status: res.status, body: await res.text(), headers };
  } catch (error) {
    return { ok: false, status: 0, body: error instanceof Error ? error.message : String(error), headers: {} };
  }
}

// The Portal answers InitiateInspection with the new inspection case's id
// carried in the response rather than as a defined field. Looked for in
// the likely places: a JSON field under a few plausible names, then the
// "CaseID--XXX" phrasing the specification's own example uses.
export function extractChildCaseId(responseBody: string, headers: Record<string, string> = {}): string | null {
  try {
    const parsed = JSON.parse(responseBody);
    if (parsed && typeof parsed === "object") {
      // Any field whose name suggests a case or inspection id, at any
      // spelling — the service's answers are not documented, so the net
      // is wide on purpose.
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (/case|inspection/i.test(key) && /id|ref|number/i.test(key) && typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        if (typeof value === "string") {
          const fromText = matchCaseId(value);
          if (fromText) return fromText;
        }
      }
    }
  } catch {
    // Not JSON — fall through to reading it as text.
  }
  const fromBody = matchCaseId(responseBody);
  if (fromBody) return fromBody;
  for (const [key, value] of Object.entries(headers)) {
    if (/case|inspection/i.test(key)) {
      const fromHeader = matchCaseId(value) || (value.trim() || null);
      if (fromHeader) return fromHeader;
    }
  }
  return null;
}

function matchCaseId(text: string): string | null {
  // The live service announces a creation as "INSP-189801 Case has been
  // created successfully" — the number first. The specification's own
  // example phrased it "CaseID--XXX created". Both are read, then any
  // INSP-series token as the last resort.
  const beforePhrase = /([A-Za-z]{2,10}-[\w/]+)\s+Case has been created/i.exec(text);
  if (beforePhrase) return beforePhrase[1];
  const specPhrase = /CaseID\s*[-–—:]+\s*([A-Za-z0-9/_-]+)/i.exec(text);
  if (specPhrase) return specPhrase[1];
  const inspSeries = /\b(INSP-[\w-]+)\b/.exec(text);
  return inspSeries ? inspSeries[1] : null;
}
