"use client";

// Telling the server about a failure that happened in the browser.
//
// The server never saw this one — the page had already been sent and
// broke while it was running. Without this the only trace is in a
// console nobody has open.

// One report per distinct failure per page load. A broken component can
// throw on every re-render, and thirty identical reports help nobody.
const alreadyReported = new Set<string>();

export function reportBrowserError(error: { message?: string; digest?: string }): void {
  try {
    const key = `${error?.digest || ""}|${error?.message || ""}`;
    if (alreadyReported.has(key)) return;
    alreadyReported.add(key);

    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error?.message || "Unknown error",
        digest: error?.digest,
        path: window.location.pathname,
      }),
      // The page may be on its way out — a reload, a click on "try
      // again". keepalive lets the report finish anyway.
      keepalive: true,
    }).catch(() => {
      // Reporting a failure must never cause one.
    });
  } catch {
    // As above.
  }
}
