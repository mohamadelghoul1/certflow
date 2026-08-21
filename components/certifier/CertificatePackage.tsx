"use client";

import { useRef, useActionState } from "react";
import Link from "next/link";
import type { ActionState } from "@/lib/actions/auth";

// Word ignores the site's Tailwind stylesheet entirely (it isn't linked
// into the exported file), so without this every exported doc would render
// as unstyled black-on-white text with no borders/spacing/fonts at all.
// Inlining each element's actual on-screen computed style is what makes the
// Word file look like the PDF/print view instead of a bare HTML dump.
const STYLE_PROPS = [
  "color",
  "background-color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-align",
  "text-decoration-line",
  "text-transform",
  "letter-spacing",
  "line-height",
  "border-top-width",
  "border-top-style",
  "border-top-color",
  "border-right-width",
  "border-right-style",
  "border-right-color",
  "border-bottom-width",
  "border-bottom-style",
  "border-bottom-color",
  "border-left-width",
  "border-left-style",
  "border-left-color",
  "border-collapse",
  "border-radius",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "width",
  "vertical-align",
  "white-space",
];

function inlineComputedStyles(live: Element, clone: Element) {
  if (live instanceof HTMLElement && clone instanceof HTMLElement) {
    const computed = window.getComputedStyle(live);
    const declarations = STYLE_PROPS.map((prop) => `${prop}:${computed.getPropertyValue(prop)}`).join(";");
    clone.setAttribute("style", declarations);
  }
  const liveChildren = live.children;
  const cloneChildren = clone.children;
  for (let i = 0; i < liveChildren.length; i++) {
    if (cloneChildren[i]) inlineComputedStyles(liveChildren[i], cloneChildren[i]);
  }
}

// Word's HTML importer only reliably breaks pages on this specific "mso"
// line-break run (a plain CSS page-break-after is not enough on its own) —
// applied wherever the document marks a boundary with data-page-break.
function applyPageBreaks(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-page-break]").forEach((el) => {
    const before = el.getAttribute("data-page-break") === "before";
    el.style.setProperty(before ? "page-break-before" : "page-break-after", "always");
    const br = document.createElement("br");
    br.setAttribute("clear", "all");
    br.style.setProperty("mso-special-character", "line-break");
    br.style.setProperty("page-break-before", "always");
    if (before) el.parentNode?.insertBefore(br, el);
    else el.insertAdjacentElement("afterend", br);
  });
}

// Its own component (rather than inline in the toolbar) because useActionState
// must run unconditionally, and signAction is only present for documents
// that support signing.
function SignButton({
  signAction,
  signFields,
  signed,
  signedLabel,
}: {
  signAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  signFields?: Record<string, string>;
  signed?: boolean;
  signedLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signAction, undefined);
  if (signed) {
    return <span className="px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 text-sm font-semibold">{signedLabel || "Signed"}</span>;
  }
  return (
    <form action={formAction} className="flex items-center gap-2">
      {Object.entries(signFields || {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-60">
        {pending ? "Signing…" : "Sign"}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

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
// gating) — this component only renders the Sign button/banner. Once
// signed, "Export as Word" is hidden — the document is final at that point,
// so re-exporting an editable copy no longer makes sense.
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
  signAction?: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  signFields?: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const canExportWord = !signAction || !signed;

  function exportWord() {
    if (!ref.current) return;
    const clone = ref.current.cloneNode(true) as HTMLElement;
    inlineComputedStyles(ref.current, clone);
    clone.querySelectorAll("[data-stamp]").forEach((n) => n.remove());
    applyPageBreaks(clone);
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
          {canExportWord && (
            <button onClick={exportWord} className="px-4 py-2 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50">
              Export as Word
            </button>
          )}
          {signAction && <SignButton signAction={signAction} signFields={signFields} signed={signed} signedLabel={signedLabel} />}
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
