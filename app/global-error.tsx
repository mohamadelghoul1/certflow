"use client";

import { useEffect } from "react";
import { reportBrowserError } from "@/lib/reportBrowserError";

// The last line of defence: a failure in the root layout itself, where
// even the app's stylesheet is gone. It has to bring its own document
// and its own colours, which is why nothing here uses a class name.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportBrowserError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f5f7fa", color: "#4a4a4d", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
        <title>CertFlow — something went wrong</title>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e6eb", borderRadius: 10, padding: 32, maxWidth: 420, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a3a5f", marginBottom: 8 }}>CertFlow couldn&rsquo;t start this page</div>
            <p style={{ fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
              Something went wrong at our end. It has been reported automatically. Try again in a moment.
            </p>
            <button
              onClick={() => retry()}
              style={{ padding: "9px 18px", borderRadius: 6, background: "#1a3a5f", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              Try again
            </button>
            {error.digest && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 20 }}>Reference: {error.digest}</div>}
          </div>
        </div>
      </body>
    </html>
  );
}
