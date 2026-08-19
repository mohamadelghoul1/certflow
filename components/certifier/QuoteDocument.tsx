"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Mail, Pencil } from "lucide-react";
import { updateQuoteTerms } from "@/lib/actions/quotes";

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

export function QuoteDocument({
  backHref,
  filename,
  mailtoHref,
  hasApplicantEmail,
  children,
}: {
  backHref: string;
  filename: string;
  mailtoHref: string;
  hasApplicantEmail: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function exportWord() {
    if (!ref.current) return;
    downloadAsWordDoc(filename, ref.current.innerHTML);
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="max-w-3xl mx-auto py-6 px-4 print:hidden flex items-center justify-between flex-wrap gap-2">
        <Link href={backHref} className="text-sm text-slate-500 hover:text-teal-800">
          ← Back to quote
        </Link>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => window.print()} className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900">
            Print / Save as PDF
          </button>
          <button onClick={exportWord} className="px-4 py-2 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50">
            Export as Word
          </button>
          <a href={mailtoHref} className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-teal-800 text-teal-800 text-sm font-semibold hover:bg-teal-50">
            <Mail size={14} /> Email to client
          </a>
        </div>
      </div>
      {!hasApplicantEmail && (
        <div className="max-w-3xl mx-auto px-4 print:hidden">
          <div className="px-4 py-2 mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md">
            No applicant email on file — add one on the quote so &quot;Email to client&quot; can pre-fill the recipient.
          </div>
        </div>
      )}
      <div ref={ref}>{children}</div>
    </div>
  );
}

export function QuoteTermsEditor({ quoteId, activeTerms, hasOverride }: { quoteId: string; activeTerms: string; hasOverride: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(activeTerms);

  if (editing) {
    return (
      <form
        action={async (formData) => {
          await updateQuoteTerms(formData);
          setEditing(false);
        }}
      >
        <input type="hidden" name="quote_id" value={quoteId} />
        <textarea
          name="terms_override"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm font-sans outline-none focus:ring-2 focus:ring-teal-600"
        />
        <div className="flex gap-2 mt-2 print:hidden">
          <button className="px-3 py-1.5 rounded-md bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-slate-500 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="print:hidden flex items-center gap-2 mb-2">
        <button onClick={() => { setDraft(activeTerms); setEditing(true); }} className="flex items-center gap-1 text-xs text-teal-700 font-medium hover:underline">
          <Pencil size={12} /> Edit closing text
        </button>
        {hasOverride && (
          <form action={updateQuoteTerms}>
            <input type="hidden" name="quote_id" value={quoteId} />
            <input type="hidden" name="terms_override" value="" />
            <button className="text-xs text-slate-400 hover:underline">Reset to auto-generated</button>
          </form>
        )}
      </div>
      <div className="text-sm space-y-3">
        {activeTerms.split("\n\n").map((para, i) => (
          <p key={i} className="whitespace-pre-line">
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}
