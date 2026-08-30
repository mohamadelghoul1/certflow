"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Pencil } from "lucide-react";
import { updateQuoteTerms } from "@/lib/actions/quotes";
import { SubmitButton } from "@/components/SubmitButton";

export function QuoteDocument({
  backHref,
  wordHref,
  mailtoHref,
  hasApplicantEmail,
  children,
}: {
  backHref: string;
  // The server route that generates a real .docx — the old client-side
  // HTML-cloning export came out of Word unstyled, since Word knows
  // nothing of the app's CSS.
  wordHref: string;
  mailtoHref: string;
  hasApplicantEmail: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface print:bg-white">
      <div className="max-w-3xl mx-auto py-6 px-4 print:hidden flex items-center justify-between flex-wrap gap-2">
        <Link href={backHref} className="text-sm text-placeholder hover:text-primary">
          ← Back to quote
        </Link>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => window.print()} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
            Save as PDF
          </button>
          <a href={wordHref} className="px-4 py-2 rounded-md border border-primary text-primary text-sm font-semibold hover:bg-hover">
            Export as Word
          </a>
          <a href={mailtoHref} className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-primary text-primary text-sm font-semibold hover:bg-hover">
            <Mail size={14} /> Email to client
          </a>
        </div>
      </div>
      {!hasApplicantEmail && (
        <div className="max-w-3xl mx-auto px-4 print:hidden">
          <div className="px-4 py-2 mb-2 text-xs text-warning-text bg-warning-bg border border-warning/50 rounded-md">
            No applicant email on file — add one on the quote so &quot;Email to client&quot; can pre-fill the recipient.
          </div>
        </div>
      )}
      <div>{children}</div>
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
          className="w-full px-3 py-2 rounded-md border border-line text-sm font-sans outline-none focus:ring-2 focus:ring-icon"
        />
        <div className="flex gap-2 mt-2 print:hidden">
          <SubmitButton className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700">Save</SubmitButton>
          <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-placeholder hover:bg-hover">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="print:hidden flex items-center gap-2 mb-2">
        <button onClick={() => { setDraft(activeTerms); setEditing(true); }} className="flex items-center gap-1 text-xs text-secondary font-medium hover:underline">
          <Pencil size={12} /> Edit closing text
        </button>
        {hasOverride && (
          <form action={updateQuoteTerms}>
            <input type="hidden" name="quote_id" value={quoteId} />
            <input type="hidden" name="terms_override" value="" />
            <SubmitButton className="text-xs text-placeholder hover:underline">Reset to auto-generated</SubmitButton>
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
