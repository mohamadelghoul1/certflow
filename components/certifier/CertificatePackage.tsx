"use client";

import { useRef, useActionState } from "react";
import Link from "next/link";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import type { ActionState } from "@/lib/actions/auth";

// Word ignores the site's Tailwind stylesheet entirely (it isn't linked
// into the exported file), so without this every exported doc would render
// as unstyled black-on-white text with no borders/spacing/fonts at all.
// Inlining each element's actual on-screen computed style is what makes the
// Word file look like the PDF/print view instead of a bare HTML dump.
//
// Deliberately excludes "width" and the horizontal margins: this app's
// layouts lean on flexbox/grid, which Word cannot render at all, so those
// properties come out of getComputedStyle as absolute pixel values (a flex
// child's allocated width, or an mx-auto container's resolved centering
// margin) that only make sense inside the flex/grid context that produced
// them. Baking a pixel width or a huge centering margin onto a plain block
// element in Word is what caused every exported page to come out blank
// with the content pushed off-page across dozens of pages. Word already
// falls back flex/grid containers to plain stacked blocks on its own (no
// stylesheet is linked, so display:flex never reaches it) — that fallback
// is what's safe to keep; only the width/margin values computed *from* it
// are not.
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
  "margin-bottom",
  "vertical-align",
  "white-space",
];

const COLOR_PROPS = new Set(["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"]);

// Tailwind v4's palette is defined in a modern CSS color space, so
// getComputedStyle() returns colors as lab(...)/oklch(...) rather than
// plain rgb(). Word's HTML parser has no idea what those functions are —
// and when it hits one inside a style attribute, it appears to discard the
// *entire* attribute, not just the unparseable color, which is what made
// exported borders/spacing/fonts disappear along with the colors.
//
// Reading back a color's *string* serialization (e.g. from a canvas
// fillStyle getter) isn't reliable — modern browsers can hand it back in
// the same lab()/oklch() form it went in as, rather than downgrading it.
// Actually rendering the color to a pixel and reading the resulting bytes
// has no such ambiguity: getImageData is specified to always return plain
// 8-bit RGBA, regardless of what color space the fill was expressed in.
let colorCtx: CanvasRenderingContext2D | null = null;
function toWordSafeColor(value: string): string {
  if (!value) return value;
  if (!colorCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!colorCtx) return value;
  colorCtx.clearRect(0, 0, 1, 1);
  colorCtx.fillStyle = value;
  colorCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = colorCtx.getImageData(0, 0, 1, 1).data;
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

// "Inter" (this app's actual font, loaded as a web font) isn't installed on
// the machine Word is running on, so leaving the raw computed font-family
// in the export just makes Word fall through the whole stack — "Inter",
// "Inter Fallback", "ui-sans-serif", "system-ui" are all meaningless to
// Word's font matcher — until it lands on some unpredictable default. Word
// ships with Calibri on every install, so mapping straight to that (or a
// monospace equivalent for the one place this app uses font-mono) gives a
// clean, predictable result instead of leaving it to chance.
function toWordSafeFont(value: string): string {
  return /mono/i.test(value) ? "Consolas, 'Courier New', monospace" : "Calibri, Arial, sans-serif";
}

function inlineComputedStyles(live: Element, clone: Element) {
  if (live instanceof HTMLElement && clone instanceof HTMLElement) {
    const computed = window.getComputedStyle(live);
    const declarations = STYLE_PROPS.map((prop) => {
      const value = computed.getPropertyValue(prop);
      if (prop === "font-family") return `font-family:${toWordSafeFont(value)}`;
      return `${prop}:${COLOR_PROPS.has(prop) ? toWordSafeColor(value) : value}`;
    });
    // Table layout is the one place a computed "width" is safe to inline:
    // unlike a flex/grid child's width (a viewport-relative pixel value
    // that only meant something in the browser's flex context — the cause
    // of the original blank/endless-page bug), a table cell's width
    // expressed as a percentage of its own table is self-contained and
    // portable. Without this, every exported table has no width at all
    // (the "width" property is otherwise deliberately excluded above), so
    // Word falls back to auto-sizing each column purely from its content —
    // which is what was producing lopsided, cramped-looking tables instead
    // of matching the on-screen proportions.
    if (live.tagName === "TABLE") {
      declarations.push("width:100%");
      // CSS alone (border-collapse, border: none) doesn't stop Word from
      // drawing its own default gridlines around every cell of an
      // imported table — that's controlled by the classic HTML border
      // attribute, which none of these tables set, since the app itself
      // never needs it (the CSS border-*-width: 0px already suppresses
      // borders correctly in the browser/print view). Without it, Word
      // boxes every single table-based layout row — which is most of this
      // document — in a visible grid that isn't there in the PDF.
      clone.setAttribute("border", "0");
      clone.setAttribute("cellpadding", "0");
      clone.setAttribute("cellspacing", "0");
    } else if (live.tagName === "TD" || live.tagName === "TH") {
      const table = live.closest("table");
      if (table) {
        const tableWidth = table.getBoundingClientRect().width;
        const cellWidth = live.getBoundingClientRect().width;
        if (tableWidth > 0) declarations.push(`width:${((cellWidth / tableWidth) * 100).toFixed(2)}%`);
      }
    } else if (live.tagName === "IMG") {
      // Left unset, an exported <img> has no size at all, so Word displays
      // it at the image file's raw native resolution rather than the small
      // on-screen size (e.g. a multi-hundred-pixel-tall logo file shown at
      // h-16 on screen) — this is what was blowing the logo up to fill and
      // overflow the whole page. Pinning both the inline style and the
      // classic HTML width/height attributes to the actual on-screen
      // rendered size is the standard fix for Word/Outlook HTML export.
      const rect = live.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w > 0 && h > 0) {
        declarations.push(`width:${w}px`, `height:${h}px`);
        clone.setAttribute("width", String(w));
        clone.setAttribute("height", String(h));
      }
    }
    clone.setAttribute("style", declarations.join(";"));
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
    // setProperty() silently drops "mso-special-character" — the CSSOM
    // rejects vendor-specific Microsoft Office property names that aren't
    // in its known-properties list, even though they're perfectly valid to
    // write as literal text inside a style attribute. Setting the whole
    // attribute as a string bypasses that validation.
    const br = document.createElement("br");
    br.setAttribute("clear", "all");
    br.setAttribute("style", "mso-special-character:line-break;page-break-before:always");
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

// The firm logo and certifier signature are rendered from short-lived
// Supabase Storage "signed" URLs (expire ~1 hour after this page loaded).
// Baking that URL straight into the exported file means Word has to fetch
// it itself when the file is later opened — which it does unreliably even
// while the link is still valid (downloaded files open in Protected View,
// which blocks fetching remote content by default), and not at all once
// the link expires. Converting each image to a base64 data: URI before
// export makes the picture part of the file itself, so it always shows up
// regardless of when the file is opened or whether the machine is online.
async function inlineImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.setAttribute("src", dataUrl);
      } catch {
        // Leave the remote URL in place as a fallback — better than an
        // empty src if the fetch itself fails.
      }
    })
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
//
// uploadAction (optional) is the answer to "how do I get my Word edits back
// into CertFlow": there is no live connection between a downloaded file
// open in Word and this page — Word can't notify a website when you press
// Save. Exporting, editing, and re-uploading the finished file here is the
// actual mechanism, so it lives right next to Export/Sign instead of buried
// elsewhere in the app.
export function CertificatePackage({
  backHref,
  filename,
  children,
  signed,
  signedLabel,
  signAction,
  signFields,
  uploadAction,
  uploadFields,
  uploadPathPrefix,
  uploadedUrl,
}: {
  backHref: string;
  filename: string;
  children: React.ReactNode;
  signed?: boolean;
  signedLabel?: string;
  signAction?: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  signFields?: Record<string, string>;
  uploadAction?: (formData: FormData) => Promise<void>;
  uploadFields?: Record<string, string>;
  uploadPathPrefix?: string;
  uploadedUrl?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const canExportWord = !signAction || !signed;

  async function exportWord() {
    if (!ref.current) return;
    const clone = ref.current.cloneNode(true) as HTMLElement;
    inlineComputedStyles(ref.current, clone);
    clone.querySelectorAll("[data-stamp]").forEach((n) => n.remove());
    applyPageBreaks(clone);
    await inlineImages(clone);
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
      {uploadAction && uploadPathPrefix && (
        <div className="max-w-3xl mx-auto px-4 print:hidden -mt-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500">Edited this in Word and want your changes reflected here? Upload the finished file:</span>
          <ActionUpload action={uploadAction} fields={uploadFields || {}} pathPrefix={uploadPathPrefix} label={uploadedUrl ? "Replace uploaded copy" : "Upload edited/signed copy"} />
          {uploadedUrl && (
            <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">
              View uploaded copy
            </a>
          )}
        </div>
      )}
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
