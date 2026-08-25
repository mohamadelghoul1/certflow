"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { asciiFileName, fileNameFromDisposition } from "@/lib/downloadName";

// A download the page fetches in the background rather than navigating to.
//
// The approved set is built on demand — the approval, then every stamped
// document behind it — so a large one takes a while, and a plain link gave
// no sign of that: the page sat there looking untouched, which invites
// pressing it again and starting the whole build a second time. Fetching
// it here means the button can say what is happening, and refuse to start
// a second build while the first is still running.
//
// Two distinct waits, reported honestly rather than as one fake
// percentage: the server building the file (nothing is flowing yet, so
// there is nothing to measure), then the bytes arriving (which there is).

type Phase = { kind: "idle" } | { kind: "preparing" } | { kind: "downloading"; received: number; total: number } | { kind: "error"; message: string };

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DownloadButton({ href, fallbackName, children, className, preparingLabel = "Preparing…" }: { href: string; fallbackName: string; children: React.ReactNode; className?: string; preparingLabel?: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busy = phase.kind === "preparing" || phase.kind === "downloading";
  // Survives the component re-rendering mid-download, which a state value
  // used as a guard would not.
  const running = useRef(false);

  async function start() {
    if (running.current) return;
    running.current = true;
    setPhase({ kind: "preparing" });

    try {
      const res = await fetch(href);
      if (!res.ok) {
        // The routes answer a refusal with a sentence worth reading —
        // "too many downloads", "not found" — so show that rather than a
        // status code the certifier has to look up.
        const said = await res
          .clone()
          .json()
          .then((body) => (typeof body?.error === "string" ? body.error : ""))
          .catch(() => "");
        throw new Error(said || `The server returned ${res.status}.`);
      }

      // Flattened to ASCII: an <a download> filename with any character
      // outside it is rejected outright by Chromium, which then saves the
      // file as "download" with no extension.
      const name = asciiFileName(fileNameFromDisposition(res.headers.get("content-disposition")) || fallbackName);
      const total = Number(res.headers.get("content-length") || 0);

      // Read the body a chunk at a time so the button can count what has
      // arrived. Without a readable stream — an old browser, or a response
      // already buffered — fall back to taking it in one go.
      let blob: Blob;
      if (res.body) {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        setPhase({ kind: "downloading", received: 0, total });
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          setPhase({ kind: "downloading", received, total });
        }
        blob = new Blob(chunks as BlobPart[], { type: res.headers.get("content-type") || "application/octet-stream" });
      } else {
        blob = await res.blob();
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Released once the browser has had the file; revoking immediately
      // can cancel the save in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPhase({ kind: "idle" });
    } catch (error) {
      setPhase({ kind: "error", message: error instanceof Error ? error.message : "The download could not be completed." });
    } finally {
      running.current = false;
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={start} disabled={busy} className={`${className || ""} disabled:opacity-60 disabled:cursor-wait`}>
        {phase.kind === "preparing" || phase.kind === "downloading" ? <Loader2 size={12} className="animate-spin" /> : null}
        {phase.kind === "preparing"
          ? preparingLabel
          : phase.kind === "downloading"
          ? phase.total > 0
            ? `Downloading… ${Math.round((phase.received / phase.total) * 100)}%`
            : `Downloading… ${mb(phase.received)}`
          : children}
      </button>
      {phase.kind === "error" && <span className="text-[11px] text-error">{phase.message}</span>}
    </span>
  );
}
