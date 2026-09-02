"use client";

import { useActionState, useState } from "react";
import { RotateCcw } from "lucide-react";
import { saveDocumentWording } from "@/lib/actions/documentWording";
import { SaveButton } from "@/components/certifier/SaveButton";
import { PLACEHOLDERS, WORDING_FIELDS } from "@/lib/certificates/documentWording";
import type { ActionState } from "@/lib/actions/auth";

// One approval document's wording.
//
// The box opens holding Certlyn's standard text rather than empty,
// because nobody writes a statutory letter from a blank page — they
// change a sentence in one that already works. Clearing the box puts the
// standard wording back rather than printing nothing, which is what a
// person means when they have second thoughts.
function WordingField({
  field,
  saved,
  platformSaved,
  platformOwner,
}: {
  field: (typeof WORDING_FIELDS)[number];
  saved: string | undefined;
  platformSaved: string | undefined;
  platformOwner: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveDocumentWording, undefined);
  // What the box opens holding: this firm's own wording, or the standard
  // the owner published, or the built-in text — the same order the
  // documents themselves resolve it in.
  const [text, setText] = useState(saved ?? platformSaved ?? field.starting);
  const custom = !!saved;

  return (
    <form action={formAction} className="border border-line rounded-md p-4 space-y-2">
      <input type="hidden" name="doc_key" value={field.key} />
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="font-semibold text-sm text-primary">{field.label}</div>
        <span className={`text-[11px] ${custom ? "text-accent" : "text-placeholder"}`}>
          {custom ? "Your wording" : platformSaved ? "Certlyn's standard wording" : "Certlyn's built-in wording"}
        </span>
      </div>
      <p className="text-[11px] text-muted">{field.help}</p>
      <textarea
        name="body"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(14, Math.max(5, text.split("\n").length + 1))}
        spellCheck
        className="w-full px-3 py-2 rounded-md border border-line text-sm leading-relaxed outline-none focus:ring-2 focus:ring-icon font-mono"
      />
      {state?.error && <div className="text-sm text-error">{state.error}</div>}
      <div className="flex items-center gap-3 flex-wrap">
        <SaveButton pending={pending} savedAt={state?.savedAt} className="px-3.5 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700">
          Save wording
        </SaveButton>
        {/* Publishing rather than saving: the standard every other firm
            starts from. Its own button, so nobody rewrites every firm's
            letter meaning to rewrite their own. */}
        {platformOwner && (
          <form
            action={formAction}
            onSubmit={(e) => {
              if (!confirm(`Make this the standard wording for every firm on Certlyn? Firms that have written their own keep theirs.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="doc_key" value={field.key} />
            <input type="hidden" name="body" value={text} />
            <input type="hidden" name="scope" value="platform" />
            <button className="px-3.5 py-1.5 rounded-md border border-primary text-primary text-xs font-semibold hover:bg-hover">
              Save as the standard for every firm
            </button>
          </form>
        )}

        {custom && (
          <button
            type="button"
            onClick={() => setText("")}
            className="inline-flex items-center gap-1.5 text-xs text-secondary hover:underline"
          >
            <RotateCcw size={12} /> Back to the standard wording
          </button>
        )}
      </div>
      {custom && text.trim() === "" && (
        <p className="text-[11px] text-warning-text">Empty — press Save wording and this document goes back to Certlyn&rsquo;s standard text.</p>
      )}
    </form>
  );
}

export function DocumentWordingEditor({
  saved,
  platformSaved = {},
  platformOwner = false,
}: {
  saved: Record<string, string>;
  platformSaved?: Record<string, string>;
  platformOwner?: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        The letters that go out with an approval. Certlyn&rsquo;s standard wording is here to start from — change what you want, leave the rest.
        Anything you don&rsquo;t touch keeps printing exactly as it does now, and a certificate already issued is never rewritten.
      </p>

      <div className="rounded-md bg-surface border border-line p-3">
        <div className="text-[11px] font-semibold text-placeholder mb-1.5">These fill themselves in on each job</div>
        <dl className="grid gap-x-4 gap-y-1 text-[11px]" style={{ gridTemplateColumns: "auto 1fr" }}>
          {PLACEHOLDERS.map((p) => (
            <div key={p.token} className="contents">
              <dt className="font-mono text-secondary">{p.token}</dt>
              <dd className="text-muted m-0">{p.meaning}</dd>
            </div>
          ))}
        </dl>
      </div>

      {WORDING_FIELDS.map((field) => (
        <WordingField key={field.key} field={field} saved={saved[field.key]} platformSaved={platformSaved[field.key]} platformOwner={platformOwner} />
      ))}
    </div>
  );
}
