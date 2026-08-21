"use client";

import { useRef } from "react";
import Link from "next/link";

function downloadAsWordDoc(filename: string, innerHtml: string) {
  const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>`;
  const footer = `</body></html>`;
  const blob = new Blob(["﻿", header + innerHtml + footer], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Wraps the whole letter/certificate package: a print:hidden toolbar (back
// link, Print, Export as Word) plus the printable content itself, held in
// a ref so "Export as Word" can grab its rendered HTML directly — same
// technique as the original prototype, just needs a Client Component
// boundary since the content underneath is otherwise plain server-rendered.
//
// signAction (optional) turns on the review-then-sign workflow shared by
// every generated document: export to Word to check/amend the text, then
// press Sign once it's ready. Until signed, the certifier's signature image
// is never inserted (the page passing signatureUrl is responsible for that
// gating) — this component only renders the Sign button/banner.
export function CertificatePackage({
  backHref,
  filename,
  children,
  signed,
  signedLabel,
  signAction,
  signFields,
}: {
  backHref: string;
  filename: string;
  children: React.ReactNode;
  signed?: boolean;
  signedLabel?: string;
  signAction?: (formData: FormData) => Promise<void>;
  signFields?: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function exportWord() {
    if (!ref.current) return;
    const clone = ref.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-stamp]").forEach((n) => n.remove());
    downloadAsWordDoc(filename, clone.innerHTML);
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="max-w-3xl mx-auto py-6 px-4 print:hidden flex items-center justify-between flex-wrap gap-2">
        <Link href={backHref} className="text-sm text-slate-500 hover:text-teal-800">
          ← Back to project
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
            Print / Save as PDF
          </button>
          <button onClick={exportWord} className="px-4 py-2 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50">
            Export as Word
          </button>
          {signAction &&
            (signed ? (
              <span className="px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 text-sm font-semibold">{signedLabel || "Signed"}</span>
            ) : (
              <form action={signAction}>
                {Object.entries(signFields || {}).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <button className="px-4 py-2 rounded-md bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800">Sign</button>
              </form>
            ))}
        </div>
      </div>
      {signAction && !signed && (
        <div className="max-w-3xl mx-auto px-4 print:hidden -mt-3 mb-4">
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Not yet signed — the signature line below is blank. Export to Word first if you need to amend anything, then press Sign once it&apos;s ready.
          </div>
        </div>
      )}
      <div ref={ref}>{children}</div>
    </div>
  );
}
